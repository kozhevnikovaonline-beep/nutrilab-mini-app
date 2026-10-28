import path from 'node:path';

// Подхватываем .env, если он есть (Node 20.12+).
try {
  process.loadEnvFile?.('.env');
} catch {
  // .env не обязателен: переменные могут прийти из окружения хостинга.
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Не задана обязательная переменная окружения ${name} (см. .env.example)`);
  return value;
}

const optional = (name: string) => process.env[name]?.trim() || undefined;

export const config = {
  botToken: required('BOT_TOKEN'),
  /** HTTPS-адрес опубликованного Mini App (GitHub Pages и т. п.). */
  webAppUrl: required('WEBAPP_URL'),
  port: Number(process.env.PORT ?? 8080),
  dataFile: path.resolve(process.env.DATA_FILE ?? './data/db.json'),
  /** @username или числовой id канала для проверки подписки (бот должен быть админом канала). */
  channelId: optional('CHANNEL_ID'),
  managerUsername: optional('MANAGER_USERNAME')?.replace(/^@/, ''),
  /** Токен платёжного провайдера из BotFather (Payments), например ЮKassa. Без него оплата рублями идёт через менеджера. */
  paymentProviderToken: optional('PAYMENT_PROVIDER_TOKEN'),
  /** Срок жизни initData. Telegram рекомендует проверять auth_date. */
  initDataMaxAgeSec: Number(process.env.INIT_DATA_MAX_AGE ?? 24 * 60 * 60),
  /** false — не запускать long polling (например, если бот обслуживается другим процессом). */
  botPolling: process.env.BOT_POLLING !== 'false',
};

export const allowedOrigin = new URL(config.webAppUrl).origin;
