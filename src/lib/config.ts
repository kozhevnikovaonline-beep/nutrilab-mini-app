/**
 * Публичная конфигурация из переменных окружения сборки (VITE_*).
 * Секреты (токен бота) сюда никогда не попадают — они живут только на сервере.
 */

const clean = (value: unknown) => (typeof value === 'string' ? value.trim().replace(/^@/, '') : '');

export const config = {
  /** Username бота без @, например nutrilab_bot. */
  botUsername: clean(import.meta.env.VITE_BOT_USERNAME) || 'nutrilab_demo_bot',
  /** Short name Mini App из BotFather (/newapp), для ссылок вида t.me/<bot>/<app>. */
  appShortName: clean(import.meta.env.VITE_APP_SHORT_NAME) || 'app',
  /** Username менеджера/эксперта для записи на консультацию. */
  managerUsername: clean(import.meta.env.VITE_MANAGER_USERNAME) || 'nutrilab_manager',
  /** Публичный канал школы. */
  channelUsername: clean(import.meta.env.VITE_CHANNEL_USERNAME) || 'nutrilab_school',
};

export const links = {
  manager: (text?: string) =>
    `https://t.me/${config.managerUsername}${text ? `?text=${encodeURIComponent(text)}` : ''}`,
  channel: () => `https://t.me/${config.channelUsername}`,
  referral: (userId: number) => `https://t.me/${config.botUsername}/${config.appShortName}?startapp=ref_${userId}`,
};
