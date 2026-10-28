/**
 * Курсы продаются за рубли. Накопленные нутрики можно списать как скидку:
 * не больше 30% цены курса, по курсу 1 нутрик = 1 ₽.
 */

/** Сколько нутриков равно 1 ₽ скидки. */
export const COINS_PER_RUBLE = 1;
/** Максимальная доля цены, которую можно оплатить нутриками. */
export const MAX_COIN_DISCOUNT_SHARE = 0.3;

export interface CoinDiscount {
  /** Максимально возможная скидка для курса, ₽. */
  maxRub: number;
  /** Скидка, доступная с текущим балансом, ₽. */
  rub: number;
  /** Сколько нутриков спишется за эту скидку. */
  coins: number;
  /** Цена к оплате со скидкой, ₽. */
  finalRub: number;
}

export function coinDiscount(priceRub: number, balance: number): CoinDiscount {
  const maxRub = Math.floor(priceRub * MAX_COIN_DISCOUNT_SHARE);
  const rub = Math.max(0, Math.min(maxRub, Math.floor(balance / COINS_PER_RUBLE)));
  return { maxRub, rub, coins: rub * COINS_PER_RUBLE, finalRub: priceRub - rub };
}

/** Проверка, что заявленное списание нутриков соответствует правилам для этой цены. */
export function isValidCoinSpend(priceRub: number, coins: number): boolean {
  return (
    Number.isInteger(coins) &&
    coins >= 0 &&
    coins % COINS_PER_RUBLE === 0 &&
    coins / COINS_PER_RUBLE <= Math.floor(priceRub * MAX_COIN_DISCOUNT_SHARE)
  );
}

// ───────────── Payload счёта Telegram Payments ─────────────

export interface CoursePayload {
  courseId: string;
  userId: number;
  /** Нутрики, которые спишутся после успешной оплаты. */
  coins: number;
}

const PAYLOAD_RE = /^course:([a-z0-9-]{1,40}):(\d{1,15}):(\d{1,9})$/;

export const makeCoursePayload = (p: CoursePayload) => `course:${p.courseId}:${p.userId}:${p.coins}`;

export function parseCoursePayload(payload: string): CoursePayload | null {
  const m = PAYLOAD_RE.exec(payload);
  return m ? { courseId: m[1], userId: Number(m[2]), coins: Number(m[3]) } : null;
}
