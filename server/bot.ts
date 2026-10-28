import { randomUUID } from 'node:crypto';
import { GUIDE } from '../shared/catalog';
import { findCourse } from '../shared/courses';
import { GameError, grantPaidCourse } from '../shared/game';
import { COINS_PER_RUBLE, coinDiscount, isValidCoinSpend, makeCoursePayload, parseCoursePayload } from '../shared/pricing';
import { FOLLOW_UPS, MAX_SCORE, QUIZ_BLOCKS, QUIZ_RESULTS, QUIZ_TITLE, focusBlocks } from '../shared/quiz';
import type { UserState } from '../shared/types';
import { config } from './config';
import type { Db } from './db';
import {
  BOT_COMMANDS,
  BOT_DESCRIPTION,
  BOT_SHORT_DESCRIPTION,
  COURSES_BUTTON,
  FALLBACK_REPLY,
  MENU_BUTTON_TEXT,
  WELCOME_BUTTON,
  welcomeMessage,
} from './botTexts';

/** Минимальный клиент Telegram Bot API без внешних зависимостей. */

type InlineButton = { text: string; web_app?: { url: string }; url?: string };

interface TgResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

interface Update {
  update_id: number;
  message?: {
    chat: { id: number; type: string };
    from?: { id: number; first_name?: string };
    text?: string;
    successful_payment?: SuccessfulPayment;
  };
  pre_checkout_query?: PreCheckoutQuery;
}

export class BotApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, body: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${config.botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json()) as TgResponse<T>;
  if (!data.ok) throw new BotApiError(res.status, data.description ?? `Bot API ${method} failed`);
  return data.result;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Кнопка, открывающая Mini App; tab — вкладка, на которой приложение откроется. */
const openAppButton = (text: string, tab?: 'quiz' | 'shop'): InlineButton => {
  const url = new URL(config.webAppUrl);
  if (tab) url.searchParams.set('tab', tab);
  return { text, web_app: { url: url.href } };
};

/** userId → start-параметр из /start, ещё не применённый (пользователь не открывал Mini App). */
export const pendingReferrals = new Map<number, string>();

const managerButton = (text: string): InlineButton =>
  config.managerUsername ? { text, url: `https://t.me/${config.managerUsername}` } : openAppButton(text);

export function sendMessage(chatId: number, html: string, buttons: InlineButton[][] = []) {
  return call('sendMessage', {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: buttons.length ? { inline_keyboard: buttons } : undefined,
  });
}

export async function isChannelMember(userId: number): Promise<boolean> {
  if (!config.channelId) return true;
  try {
    const member = await call<{ status: string }>('getChatMember', { chat_id: config.channelId, user_id: userId });
    return ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
  } catch {
    return false;
  }
}

/** Текст лид-магнита «Энергия на тарелке», персонализированный по результатам теста. */
export function leadMagnetMessage(state: UserState): string {
  const quiz = state.quiz!;
  const result = QUIZ_RESULTS[quiz.tier];
  const focus = focusBlocks(quiz.blockScores);
  const focusIdx = focus.length ? focus : [4];

  const lines = [
    `🎁 <b>Ваш гид «${GUIDE.title}»</b>`,
    '',
    `Результат теста: <b>${quiz.score} из ${MAX_SCORE}</b> — ${escapeHtml(result.title.toLowerCase())}.`,
    '',
    '<b>Ваш фокус на эту неделю</b>',
    ...focusIdx.flatMap((i) => [
      '',
      `${QUIZ_BLOCKS[i].emoji} <b>${escapeHtml(QUIZ_BLOCKS[i].title)}</b>`,
      ...GUIDE.focusTips[i].map((t) => `• ${escapeHtml(t)}`),
    ]),
    '',
    '<b>Правило тарелки</b>',
    ...GUIDE.plate.map((p) => `${p.share} — ${escapeHtml(p.label.toLowerCase())} (${escapeHtml(p.hint)})`),
    '',
    'Меню на 3 дня и ежедневный чек-лист привычек — в приложении 👇',
    '',
    '<i>Гид носит информационный характер и не заменяет консультацию врача.</i>',
  ];
  return lines.join('\n');
}

export async function deliverLeadMagnet(db: Db, userId: number): Promise<boolean> {
  const record = db.get(userId);
  if (!record?.state.quiz) return false;
  try {
    await sendMessage(userId, leadMagnetMessage(record.state), [
      [openAppButton('📖 Открыть гид в приложении')],
      [managerButton(QUIZ_RESULTS[record.state.quiz.tier].cta)],
    ]);
    db.set(userId, { ...db.get(userId)!, leadMagnetSentAt: Date.now(), botStarted: true });
    return true;
  } catch (err) {
    // 403 — пользователь не запускал бота или заблокировал его.
    if (err instanceof BotApiError && err.status === 403) db.set(userId, { ...db.get(userId)!, botStarted: false });
    console.warn(`[bot] lead magnet to ${userId} failed:`, (err as Error).message);
    return false;
  }
}

/** Дожимы через 24 и 48 часов после прохождения теста (тексты из сценария заказчика). */
export async function runFollowUps(db: Db, now = Date.now()) {
  for (const [userId, record] of db.all()) {
    const quiz = record.state.quiz;
    if (!quiz || !record.botStarted) continue;
    for (const f of FOLLOW_UPS) {
      if (record.followUps[f.key] || now - quiz.completedAt < f.delayMs) continue;
      // Не отправляем «вчерашнее» сообщение, если уже прошло время следующего.
      const next = FOLLOW_UPS[FOLLOW_UPS.indexOf(f) + 1];
      const stale = next && now - quiz.completedAt >= next.delayMs;
      try {
        if (!stale) await sendMessage(userId, f.text.map(escapeHtml).join('\n\n'), [[managerButton(f.button)]]);
      } catch (err) {
        console.warn(`[bot] follow-up ${f.key} to ${userId} failed:`, (err as Error).message);
        if (err instanceof BotApiError && err.status === 403) {
          db.set(userId, { ...record, botStarted: false });
          break;
        }
      }
      record.followUps[f.key] = now;
      db.set(userId, record);
    }
  }
}

// ───────────────────────── Настройка бота ─────────────────────────

/** Описание, команды и кнопка меню. Идемпотентно — можно вызывать при каждом запуске. */
export async function configureBot() {
  await call('setMyDescription', { description: BOT_DESCRIPTION });
  await call('setMyShortDescription', { short_description: BOT_SHORT_DESCRIPTION });
  await call('setMyCommands', { commands: BOT_COMMANDS });
  await call('setChatMenuButton', { menu_button: { type: 'web_app', text: MENU_BUTTON_TEXT, web_app: { url: config.webAppUrl } } });
}

export const getMe = () => call<{ id: number; username: string; first_name: string }>('getMe');

// ───────────────────────── Оплата курсов рублями ─────────────────────────

/**
 * Ссылка на счёт Telegram Payments для Mini App (WebApp.openInvoice).
 * Скидка нутриками считается по серверному балансу; сами нутрики спишутся только после оплаты.
 */
export async function createCourseInvoice(userId: number, courseId: string, balance: number, useCoins: boolean): Promise<string> {
  const course = findCourse(courseId);
  if (!course) throw new GameError('NOT_FOUND', 'Курс не найден');
  const discount = useCoins ? coinDiscount(course.priceRub, balance) : null;
  const coins = discount?.coins ?? 0;
  const amountRub = discount?.finalRub ?? course.priceRub;
  const label = coins ? `${course.title.slice(0, 18)} (−${discount!.rub} ₽ нутриками)` : course.title.slice(0, 32);
  return call<string>('createInvoiceLink', {
    title: course.title.slice(0, 32),
    description: `${course.subtitle}. ${course.description}`.slice(0, 255),
    payload: makeCoursePayload({ courseId: course.id, userId, coins }),
    provider_token: config.paymentProviderToken,
    currency: 'RUB',
    prices: [{ label, amount: amountRub * 100 }],
    photo_url: course.image,
    photo_width: 800,
    photo_height: 600,
    need_email: true,
    send_email_to_provider: true,
  });
}

interface PreCheckoutQuery {
  id: string;
  from: { id: number };
  currency: string;
  total_amount: number;
  invoice_payload: string;
}

interface SuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
}

/** Последняя проверка перед списанием денег: курс, сумма со скидкой, покупатель и баланс нутриков. */
async function handlePreCheckout(db: Db, q: PreCheckoutQuery) {
  const parsed = parseCoursePayload(q.invoice_payload);
  const course = parsed && findCourse(parsed.courseId);
  const record = db.get(q.from.id);
  let error: string | undefined;
  if (!parsed || !course || parsed.userId !== q.from.id || !isValidCoinSpend(course.priceRub, parsed.coins)) {
    error = 'Не удалось проверить заказ. Попробуйте ещё раз из приложения.';
  } else if (q.currency !== 'RUB' || q.total_amount !== (course.priceRub - parsed.coins / COINS_PER_RUBLE) * 100) {
    error = 'Цена курса изменилась. Откройте курс заново.';
  } else if (record?.state.purchases.some((p) => p.productId === course.id)) {
    error = 'Этот курс уже у вас.';
  } else if ((record?.state.game.balance ?? 0) < parsed.coins) {
    error = 'Нутриков на балансе стало меньше. Откройте курс заново.';
  }
  await call('answerPreCheckoutQuery', error ? { pre_checkout_query_id: q.id, ok: false, error_message: error } : { pre_checkout_query_id: q.id, ok: true });
}

async function handleSuccessfulPayment(db: Db, userId: number, payment: SuccessfulPayment) {
  const parsed = parseCoursePayload(payment.invoice_payload);
  const record = db.get(userId);
  if (!parsed || parsed.userId !== userId || !record) {
    console.error('[pay] payment without matching user/course', userId, payment.telegram_payment_charge_id);
    return;
  }
  const { state, effect } = grantPaidCourse(record.state, parsed.courseId, { now: Date.now(), genId: randomUUID }, parsed.coins);
  db.set(userId, { ...record, state });
  const course = findCourse(parsed.courseId)!;
  console.log(
    `[pay] ${userId} paid ${payment.total_amount / 100} RUB + ${parsed.coins} coins for ${course.id}, charge ${payment.telegram_payment_charge_id}`,
  );
  await sendMessage(
    userId,
    [
      '✅ <b>Оплата прошла!</b>',
      '',
      `«${escapeHtml(course.title)}» теперь ваш. Код доступа: <code>${effect.purchase?.code}</code>`,
      ...(parsed.coins ? [`Скидка нутриками: −${parsed.coins / COINS_PER_RUBLE} ₽ (списано ${parsed.coins} нутриков).`] : []),
      '',
      'Куратор откроет уроки в ближайшее время. Чек об оплате придёт на почту.',
    ].join('\n'),
    [[openAppButton('🎓 Открыть курс в приложении', 'shop')], [managerButton('💬 Написать куратору')]],
  );
}

// ───────────────────────── Обработка сообщений ─────────────────────────

/** Первое сообщение воронки: фото-обложка + текст + кнопка теста. */
async function sendWelcome(userId: number, firstName?: string) {
  const buttons = [[openAppButton(WELCOME_BUTTON, 'quiz')], [openAppButton(COURSES_BUTTON, 'shop')]];
  try {
    await call('sendPhoto', {
      chat_id: userId,
      photo: new URL('bot-cover.jpg', config.webAppUrl).href,
      caption: welcomeMessage(firstName),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    });
  } catch {
    // Обложка недоступна — отправляем то же сообщение без фото.
    await sendMessage(userId, welcomeMessage(firstName), buttons);
  }
}

async function handleUpdate(db: Db, update: Update) {
  if (update.pre_checkout_query) return handlePreCheckout(db, update.pre_checkout_query);

  const msg = update.message;
  if (!msg || msg.chat.type !== 'private' || !msg.from) return;
  const userId = msg.from.id;
  const record = db.get(userId);
  if (record && !record.botStarted) db.set(userId, { ...record, botStarted: true });

  if (msg.successful_payment) return handleSuccessfulPayment(db, userId, msg.successful_payment);

  const text = msg.text ?? '';
  if (text.startsWith('/start')) {
    const payload = text.split(' ')[1];
    // Ссылка вида t.me/<bot>?start=ref_123: запоминаем пригласившего до первого входа в Mini App.
    if (!record && payload) pendingReferrals.set(userId, payload);
    await sendWelcome(userId, msg.from.first_name);
  } else if (text.startsWith('/test')) {
    await sendMessage(userId, `📝 Тест «${escapeHtml(QUIZ_TITLE)}» — 25 вопросов, 1–3 минуты. Гид в подарок сразу после результата.`, [
      [openAppButton(WELCOME_BUTTON, 'quiz')],
    ]);
  } else if (text.startsWith('/courses')) {
    await sendMessage(userId, '🎓 Курсы и консультации нутрициолога оплачиваются картой, а нутриками из приложения можно оплатить до 30% цены: 1 нутрик = 1 ₽.', [
      [openAppButton(COURSES_BUTTON, 'shop')],
    ]);
  } else {
    await sendMessage(userId, FALLBACK_REPLY, [[openAppButton('Открыть NutriLab')]]);
  }
}

/** Long polling. Для продакшена с вебхуком — вызывайте handleUpdate из HTTP-обработчика. */
export async function startPolling(db: Db, signal: AbortSignal) {
  await call('deleteWebhook', { drop_pending_updates: false });
  await configureBot();

  let offset = 0;
  while (!signal.aborted) {
    try {
      const updates = await call<Update[]>(
        'getUpdates',
        { offset, timeout: 25, allowed_updates: ['message', 'pre_checkout_query'] },
        35_000,
      );
      for (const u of updates) {
        offset = u.update_id + 1;
        await handleUpdate(db, u).catch((err) => console.warn('[bot] update failed:', (err as Error).message));
      }
    } catch (err) {
      if (signal.aborted) break;
      console.warn('[bot] polling error:', (err as Error).message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
