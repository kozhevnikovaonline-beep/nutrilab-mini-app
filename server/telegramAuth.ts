import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifiedInitData {
  user: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
  };
  authDate: number;
  startParam?: string;
}

export class InitDataError extends Error {}

/**
 * Проверка подписи initData по алгоритму Telegram:
 * secret = HMAC_SHA256("WebAppData", bot_token); hash = HMAC_SHA256(secret, data_check_string).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSec: number,
  nowSec = Math.floor(Date.now() / 1000),
): VerifiedInitData {
  if (!initData || initData.length > 4096) throw new InitDataError('initData отсутствует');
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) throw new InitDataError('Нет подписи');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) throw new InitDataError('Неверная подпись');

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || nowSec - authDate > maxAgeSec) throw new InitDataError('initData устарели');

  let user: VerifiedInitData['user'];
  try {
    user = JSON.parse(params.get('user') ?? '');
  } catch {
    throw new InitDataError('Нет данных пользователя');
  }
  if (!user || typeof user.id !== 'number' || typeof user.first_name !== 'string') {
    throw new InitDataError('Нет данных пользователя');
  }

  return { user, authDate, startParam: params.get('start_param') ?? undefined };
}

/** Подписывает initData — используется в тестах для генерации валидных данных. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
