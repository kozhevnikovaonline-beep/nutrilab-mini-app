import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { GameError } from '../shared/game';
import { allowedOrigin, config } from './config';
import { Db } from './db';
import { InitDataError, verifyInitData } from './telegramAuth';
import { applyAction, bootstrapUser, withUserLock, type ServiceDeps } from './service';
import {
  createCourseInvoice,
  deliverLeadMagnet,
  isChannelMember,
  pendingReferrals,
  runFollowUps,
  sendMessage,
  startPolling,
} from './bot';
import { findCourse } from '../shared/courses';

const MAX_BODY_BYTES = 16 * 1024;
const RATE_WINDOW_MS = 10_000;
const RATE_LIMIT = 60;

const db = new Db(config.dataFile);
await db.load();

const deps: ServiceDeps = {
  isChannelMember,
  notify: (userId, html) => sendMessage(userId, html),
  pendingReferral: (userId) => {
    const value = pendingReferrals.get(userId);
    pendingReferrals.delete(userId);
    return value;
  },
};

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const hits = new Map<number, { count: number; resetAt: number }>();
function rateLimit(userId: number) {
  const now = Date.now();
  const entry = hits.get(userId);
  if (!entry || entry.resetAt < now) {
    hits.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  if (++entry.count > RATE_LIMIT) throw new HttpError(429, 'SERVER', 'Слишком много запросов, подождите немного');
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'INVALID_ACTION', 'Слишком большой запрос');
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'INVALID_ACTION', 'Некорректный JSON');
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function createInvoice(userId: number, body: unknown) {
  if (!config.paymentProviderToken) {
    throw new HttpError(503, 'PAYMENTS_DISABLED', 'Онлайн-оплата пока не подключена');
  }
  const { courseId, useCoins } = (body ?? {}) as { courseId?: unknown; useCoins?: unknown };
  if (typeof courseId !== 'string' || !findCourse(courseId)) throw new HttpError(404, 'NOT_FOUND', 'Курс не найден');
  if (db.get(userId)?.state.purchases.some((p) => p.productId === courseId)) {
    throw new HttpError(409, 'ALREADY_PURCHASED', 'Этот курс уже у вас');
  }
  const balance = db.get(userId)?.state.game.balance ?? 0;
  return { invoiceUrl: await createCourseInvoice(userId, courseId, balance, useCoins === true) };
}

function authenticate(req: IncomingMessage) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('tma ')) throw new HttpError(401, 'UNAUTHORIZED', 'Откройте приложение из Telegram');
  try {
    return verifyInitData(header.slice(4), config.botToken, config.initDataMaxAgeSec);
  } catch (err) {
    if (err instanceof InitDataError) throw new HttpError(401, 'UNAUTHORIZED', 'Не удалось подтвердить вход — перезапустите приложение');
    throw err;
  }
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { ok: true });
    return;
  }

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'SERVER', 'Метод не поддерживается');
    const auth = authenticate(req);
    const userId = auth.user.id;
    rateLimit(userId);
    const body = await readJson(req);

    const data = await withUserLock(userId, async () => {
      switch (req.url) {
        case '/api/bootstrap':
          return bootstrapUser(db, auth, deps);
        case '/api/action':
          return applyAction(db, userId, body, deps);
        case '/api/invoice':
          return createInvoice(userId, body);
        case '/api/lead-magnet':
          return { sentToChat: await deliverLeadMagnet(db, userId) };
        default:
          throw new HttpError(404, 'NOT_FOUND', 'Неизвестный метод API');
      }
    });
    send(res, 200, { ok: true, data });
  } catch (err) {
    if (err instanceof HttpError) {
      send(res, err.status, { ok: false, error: { code: err.code, message: err.message } });
    } else if (err instanceof GameError) {
      send(res, 422, { ok: false, error: { code: err.code, message: err.message } });
    } else {
      console.error('[api] unexpected error', err);
      send(res, 500, { ok: false, error: { code: 'SERVER', message: 'Внутренняя ошибка сервера' } });
    }
  }
});

server.listen(config.port, () => console.log(`[api] listening on :${config.port}, web app: ${config.webAppUrl}`));

const abort = new AbortController();
if (config.botPolling) {
  startPolling(db, abort.signal).catch((err) => console.error('[bot] failed to start:', err));
}

const followUpTimer = setInterval(() => void runFollowUps(db).catch((e) => console.error('[bot] follow-ups', e)), 5 * 60_000);

async function shutdown() {
  abort.abort();
  clearInterval(followUpTimer);
  server.close();
  await db.flush();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
