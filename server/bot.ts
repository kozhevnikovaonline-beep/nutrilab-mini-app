import { GUIDE, SCHOOL } from '../shared/catalog';
import { FOLLOW_UPS, MAX_SCORE, QUIZ_BLOCKS, QUIZ_RESULTS, QUIZ_TITLE, focusBlocks } from '../shared/quiz';
import type { UserState } from '../shared/types';
import { config } from './config';
import type { Db } from './db';

/** Минимальный клиент Telegram Bot API без внешних зависимостей. */

type InlineButton = { text: string; web_app?: { url: string }; url?: string };

interface TgResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

interface Update {
  update_id: number;
  message?: { chat: { id: number; type: string }; from?: { id: number }; text?: string };
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

const openAppButton = (text: string): InlineButton => ({ text, web_app: { url: config.webAppUrl } });

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

async function handleUpdate(db: Db, update: Update) {
  const msg = update.message;
  if (!msg || msg.chat.type !== 'private' || !msg.from) return;
  const userId = msg.from.id;
  const record = db.get(userId);
  if (record && !record.botStarted) db.set(userId, { ...record, botStarted: true });

  if (msg.text?.startsWith('/start')) {
    const payload = msg.text.split(' ')[1];
    // Ссылка вида t.me/<bot>?start=ref_123: запоминаем пригласившего до первого входа в Mini App.
    if (!record && payload) pendingReferrals.set(userId, payload);
    await sendMessage(
      userId,
      [
        `🌿 <b>Добро пожаловать в ${SCHOOL.name}!</b>`,
        '',
        'Здесь вы можете:',
        `• пройти тест «${QUIZ_TITLE}» — 25 вопросов, 1–3 минуты;`,
        `• получить персональный гид «${GUIDE.title}» в подарок;`,
        '• копить нутрики в тапалке и обменивать их на материалы, курсы и консультации школы.',
        '',
        'Нажмите кнопку ниже, чтобы начать 👇',
      ].join('\n'),
      [[openAppButton('🚀 Открыть NutriLab')]],
    );
  } else {
    await sendMessage(userId, 'Всё самое интересное — в приложении 👇', [[openAppButton('Открыть NutriLab')]]);
  }
}

/** Long polling. Для продакшена с вебхуком — вызывайте handleUpdate из HTTP-обработчика. */
export async function startPolling(db: Db, signal: AbortSignal) {
  await call('deleteWebhook', { drop_pending_updates: false });
  await call('setMyCommands', { commands: [{ command: 'start', description: 'Открыть NutriLab' }] });
  // Кнопка меню чата открывает Mini App.
  await call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'NutriLab', web_app: { url: config.webAppUrl } } });

  let offset = 0;
  while (!signal.aborted) {
    try {
      const updates = await call<Update[]>('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, 35_000);
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
