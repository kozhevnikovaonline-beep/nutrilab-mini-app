import { GUIDE, QUIZ_REWARD, SCHOOL } from '../shared/catalog';
import { QUIZ_TITLE } from '../shared/quiz';

/**
 * Тексты бота. Описание и короткое описание выставляются через Bot API
 * (npm run bot:setup или при запуске сервера) — вручную в BotFather ничего вводить не нужно.
 */

/** Экран «Что умеет этот бот?» до нажатия «Запустить» (до 512 символов). */
export const BOT_DESCRIPTION = [
  `🌿 ${SCHOOL.name} — онлайн-школа нутрициологии.`,
  '',
  `Пройдите тест «${QUIZ_TITLE}» за 1–3 минуты и получите персональный гид «${GUIDE.title}» в подарок.`,
  '',
  'Копите нутрики за тест, задания и ежедневные визиты — оплачивайте ими до 30% цены курсов и консультаций нутрициолога или берите полезные материалы.',
  '',
  'Нажмите «Запустить», чтобы начать 👇',
].join('\n');

/** Описание в профиле бота и при пересылке ссылки на него (до 120 символов). */
export const BOT_SHORT_DESCRIPTION = `Тест о самочувствии, гид «${GUIDE.title}» в подарок и курсы нутрициолога со скидкой нутриками 🌿`;

export const BOT_COMMANDS = [
  { command: 'start', description: 'Открыть NutriLab' },
  { command: 'test', description: 'Пройти тест о самочувствии' },
  { command: 'courses', description: 'Курсы нутрициолога' },
];

export const MENU_BUTTON_TEXT = 'NutriLab';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Первое сообщение воронки — ответ на /start. Подпись к фото: до 1024 символов. */
export function welcomeMessage(firstName?: string) {
  const name = firstName ? `, ${escapeHtml(firstName.slice(0, 40))}` : '';
  return [
    `<b>Здравствуйте${name}! 🌿</b>`,
    '',
    'Бывает, что вроде бы всё в порядке, но энергии не хватает, сон не восстанавливает, а после еды тяжело. Часто дело в привычках — и их можно мягко настроить без жёстких диет.',
    '',
    `Я — помощник онлайн-школы <b>${SCHOOL.name}</b> и нутрициолога ${SCHOOL.expert.name}. Вот с чего начать:`,
    '',
    `1️⃣ <b>Тест «${escapeHtml(QUIZ_TITLE)}»</b> — 25 вопросов, 1–3 минуты`,
    `2️⃣ <b>Гид «${GUIDE.title}» в подарок</b> — ваши зоны фокуса, меню на 3 дня и чек-лист`,
    `3️⃣ <b>+${QUIZ_REWARD} нутриков</b> на баланс — ими можно оплатить до 30% цены курсов`,
    '',
    'Нажмите кнопку ниже — тест откроется прямо в Telegram 👇',
  ].join('\n');
}

export const WELCOME_BUTTON = '📝 Пройти тест и получить гид';
export const COURSES_BUTTON = '🎓 Курсы нутрициолога';

export const FALLBACK_REPLY = 'Всё самое интересное — в приложении NutriLab 👇';
