/**
 * Доменные типы, общие для клиента (Mini App) и сервера (бот + API).
 * Любое изменение структуры UserState требует увеличения STATE_VERSION
 * и миграции в shared/game.ts → migrateState().
 */

export type AnswerValue = 0 | 1 | 2;

export type ResultTier = 'good' | 'attention' | 'priority';

export type UpgradeId = 'multitap' | 'energy';

export interface UserProfile {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
}

export interface GameState {
  balance: number;
  totalEarned: number;
  totalTaps: number;
  energy: number;
  /** Момент, до которого восстановление энергии уже учтено (ms). */
  energyUpdatedAt: number;
  upgrades: Record<UpgradeId, number>;
}

export interface QuizState {
  answers: AnswerValue[];
  score: number;
  /** Сумма баллов по каждому из 5 блоков (0–10). */
  blockScores: number[];
  tier: ResultTier;
  completedAt: number;
  attempts: number;
}

export interface Purchase {
  id: string;
  productId: string;
  /** Промокод/код доступа, который пользователь передаёт менеджеру школы. */
  code: string;
  purchasedAt: number;
  /** Как оплачено: нутриками или рублями. */
  method?: 'coins' | 'rub';
  /** Нутрики, списанные как скидка при оплате рублями. */
  coinsSpent?: number;
}

export interface HabitLog {
  /** День в формате YYYY-MM-DD (UTC). */
  date: string;
  done: string[];
  /** Привычки, за которые сегодня уже начислены монеты (защита от повторного начисления). */
  rewarded: string[];
}

export interface UserState {
  version: number;
  profile: UserProfile;
  game: GameState;
  quiz: QuizState | null;
  purchases: Purchase[];
  /** taskId → время получения награды. */
  tasks: Record<string, number>;
  daily: { lastClaimDate: string | null; streak: number };
  habits: HabitLog;
  referrals: number;
  referredBy?: number;
  createdAt: number;
}

export type GameAction =
  | { type: 'taps'; count: number }
  | { type: 'quiz/submit'; answers: AnswerValue[] }
  | { type: 'daily/claim' }
  | { type: 'task/claim'; taskId: string }
  | { type: 'habit/toggle'; habitId: string }
  | { type: 'upgrade/buy'; upgradeId: UpgradeId }
  | { type: 'product/buy'; productId: string };

export interface ActionEffect {
  /** Сколько монет начислено этим действием (для тостов/анимаций). */
  coins?: number;
  purchase?: Purchase;
}

export interface ActionResult {
  state: UserState;
  effect: ActionEffect;
}

export type GameErrorCode =
  | 'INVALID_ACTION'
  | 'NOT_ENOUGH_COINS'
  | 'NOT_ENOUGH_ENERGY'
  | 'ALREADY_CLAIMED'
  | 'ALREADY_PURCHASED'
  | 'MAX_LEVEL'
  | 'TASK_NOT_COMPLETED'
  | 'NOT_FOUND';
