import {
  BASE_MAX_ENERGY,
  DAILY_REWARDS,
  ENERGY_REGEN_PER_SEC,
  HABITS,
  HABIT_REWARD,
  LEVELS,
  MAX_TAPS_PER_BATCH,
  PRODUCTS,
  QUIZ_REWARD,
  TASKS,
  UPGRADES,
  type LevelDef,
} from './catalog';
import { findCourse } from './courses';
import { isCompleteAnswers, scoreQuiz } from './quiz';
import type {
  ActionResult,
  AnswerValue,
  GameAction,
  GameErrorCode,
  GameState,
  Purchase,
  UpgradeId,
  UserProfile,
  UserState,
} from './types';

/**
 * Чистая игровая логика. Один и тот же редьюсер работает в мок-API (в браузере)
 * и на сервере, поэтому правила экономики невозможно рассинхронизировать.
 */

export const STATE_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

export class GameError extends Error {
  constructor(
    public readonly code: GameErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export interface ReduceContext {
  now: number;
  /** Генератор уникальных идентификаторов/кодов (crypto на сервере и в браузере). */
  genId: () => string;
  /**
   * Результат внешней проверки задания (подписка на канал и т. п.).
   * Если не передан — задания такого типа считаются выполненными (демо-режим).
   */
  isTaskVerified?: (taskId: string, state: UserState) => boolean;
}

export const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);

export function createInitialState(profile: UserProfile, now: number): UserState {
  return {
    version: STATE_VERSION,
    profile,
    game: {
      balance: 0,
      totalEarned: 0,
      totalTaps: 0,
      energy: BASE_MAX_ENERGY,
      energyUpdatedAt: now,
      upgrades: { multitap: 0, energy: 0 },
    },
    quiz: null,
    purchases: [],
    tasks: {},
    daily: { lastClaimDate: null, streak: 0 },
    habits: { date: dayKey(now), done: [], rewarded: [] },
    referrals: 0,
    createdAt: now,
  };
}

/** Приводит сохранённое состояние к актуальной версии. Возвращает null, если данные непригодны. */
export function migrateState(raw: unknown): UserState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<UserState>;
  if (s.version !== STATE_VERSION || !s.game || !s.profile) return null;
  return s as UserState;
}

// ───────────────────────── Производные значения ─────────────────────────

export const maxEnergy = (game: GameState) => BASE_MAX_ENERGY + game.upgrades.energy * 250;
export const tapPower = (game: GameState) => 1 + game.upgrades.multitap;

export function currentLevel(totalEarned: number): {
  index: number;
  level: LevelDef;
  next?: LevelDef;
  progress: number;
} {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (totalEarned >= LEVELS[i].minEarned) index = i;
  const level = LEVELS[index];
  const next = LEVELS[index + 1];
  const progress = next ? (totalEarned - level.minEarned) / (next.minEarned - level.minEarned) : 1;
  return { index, level, next, progress: Math.min(1, Math.max(0, progress)) };
}

export function upgradeCost(game: GameState, id: UpgradeId): number | null {
  const level = game.upgrades[id];
  return UPGRADES[id].costs[level] ?? null;
}

/** Восстанавливает энергию по прошедшему времени, не теряя дробные доли секунд. */
export function regenEnergy(game: GameState, now: number): GameState {
  const max = maxEnergy(game);
  if (game.energy >= max) return { ...game, energy: max, energyUpdatedAt: now };
  const elapsed = Math.max(0, now - game.energyUpdatedAt);
  const gained = Math.floor((elapsed / 1000) * ENERGY_REGEN_PER_SEC);
  if (gained <= 0) return game;
  const energy = Math.min(max, game.energy + gained);
  const energyUpdatedAt =
    energy >= max ? now : game.energyUpdatedAt + Math.round((gained / ENERGY_REGEN_PER_SEC) * 1000);
  return { ...game, energy, energyUpdatedAt };
}

export function dailyRewardFor(streak: number): number {
  return DAILY_REWARDS[(Math.max(1, streak) - 1) % DAILY_REWARDS.length];
}

/** Какой будет серия и можно ли забрать бонус сегодня. */
export function dailyStatus(state: UserState, now: number) {
  const today = dayKey(now);
  const yesterday = dayKey(now - DAY_MS);
  const { lastClaimDate, streak } = state.daily;
  const claimedToday = lastClaimDate === today;
  const nextStreak = claimedToday ? streak : lastClaimDate === yesterday ? streak + 1 : 1;
  return { claimedToday, nextStreak, reward: dailyRewardFor(nextStreak) };
}

export function habitsForToday(state: UserState, now: number) {
  const today = dayKey(now);
  return state.habits.date === today ? state.habits : { date: today, done: [], rewarded: [] };
}

function credit(game: GameState, coins: number): GameState {
  return { ...game, balance: game.balance + coins, totalEarned: game.totalEarned + coins };
}

function spend(game: GameState, coins: number): GameState {
  if (game.balance < coins) {
    throw new GameError('NOT_ENOUGH_COINS', `Не хватает ${coins - game.balance} нутриков`);
  }
  return { ...game, balance: game.balance - coins };
}

// ───────────────────────── Валидация входящих действий ─────────────────────────

/** Строгая проверка действия, пришедшего из недоверенного источника (клиент → сервер). */
export function parseAction(input: unknown): GameAction {
  const fail = (): never => {
    throw new GameError('INVALID_ACTION', 'Некорректное действие');
  };
  if (!input || typeof input !== 'object') fail();
  const a = input as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : fail());

  switch (a.type) {
    case 'taps': {
      const count = a.count;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > MAX_TAPS_PER_BATCH) fail();
      return { type: 'taps', count: count as number };
    }
    case 'quiz/submit':
      if (!isCompleteAnswers(a.answers)) fail();
      return { type: 'quiz/submit', answers: [...(a.answers as AnswerValue[])] };
    case 'daily/claim':
      return { type: 'daily/claim' };
    case 'task/claim':
      return { type: 'task/claim', taskId: str(a.taskId) as string };
    case 'habit/toggle':
      return { type: 'habit/toggle', habitId: str(a.habitId) as string };
    case 'upgrade/buy':
      if (a.upgradeId !== 'multitap' && a.upgradeId !== 'energy') fail();
      return { type: 'upgrade/buy', upgradeId: a.upgradeId as UpgradeId };
    case 'product/buy':
      return { type: 'product/buy', productId: str(a.productId) as string };
    default:
      return fail();
  }
}

// ───────────────────────── Редьюсер ─────────────────────────

export function reduce(state: UserState, action: GameAction, ctx: ReduceContext): ActionResult {
  const { now } = ctx;
  const game = regenEnergy(state.game, now);

  switch (action.type) {
    case 'taps': {
      const power = tapPower(game);
      const possible = Math.floor(game.energy / power);
      const taps = Math.min(action.count, possible);
      if (taps <= 0) throw new GameError('NOT_ENOUGH_ENERGY', 'Энергия закончилась — она скоро восстановится');
      const coins = taps * power;
      // regenEnergy уже сдвинул energyUpdatedAt на «сейчас», если энергия была полной.
      const next: GameState = {
        ...credit(game, coins),
        energy: game.energy - coins,
        totalTaps: game.totalTaps + taps,
      };
      return { state: { ...state, game: next }, effect: { coins } };
    }

    case 'quiz/submit': {
      const { score, blockScores, tier } = scoreQuiz(action.answers);
      const firstTime = !state.quiz;
      const coins = firstTime ? QUIZ_REWARD : 0;
      return {
        state: {
          ...state,
          game: coins ? credit(game, coins) : game,
          quiz: {
            answers: [...action.answers],
            score,
            blockScores,
            tier,
            completedAt: now,
            attempts: (state.quiz?.attempts ?? 0) + 1,
          },
          tasks: firstTime ? { ...state.tasks, quiz: now } : state.tasks,
        },
        effect: { coins },
      };
    }

    case 'daily/claim': {
      const status = dailyStatus(state, now);
      if (status.claimedToday) throw new GameError('ALREADY_CLAIMED', 'Сегодняшний бонус уже получен');
      return {
        state: {
          ...state,
          game: credit(game, status.reward),
          daily: { lastClaimDate: dayKey(now), streak: status.nextStreak },
        },
        effect: { coins: status.reward },
      };
    }

    case 'task/claim': {
      const task = TASKS.find((t) => t.id === action.taskId);
      if (!task) throw new GameError('NOT_FOUND', 'Задание не найдено');
      if (state.tasks[task.id]) throw new GameError('ALREADY_CLAIMED', 'Награда уже получена');
      const completed =
        task.kind === 'quiz'
          ? Boolean(state.quiz)
          : task.kind === 'guide'
            ? Boolean(state.quiz)
            : task.kind === 'referral'
              ? state.referrals > 0
              : (ctx.isTaskVerified?.(task.id, state) ?? true);
      if (!completed) throw new GameError('TASK_NOT_COMPLETED', 'Задание ещё не выполнено');
      return {
        state: { ...state, game: credit(game, task.reward), tasks: { ...state.tasks, [task.id]: now } },
        effect: { coins: task.reward },
      };
    }

    case 'habit/toggle': {
      if (!HABITS.some((h) => h.id === action.habitId)) throw new GameError('NOT_FOUND', 'Привычка не найдена');
      const log = habitsForToday(state, now);
      const isDone = log.done.includes(action.habitId);
      const done = isDone ? log.done.filter((id) => id !== action.habitId) : [...log.done, action.habitId];
      const shouldReward = !isDone && !log.rewarded.includes(action.habitId);
      const rewarded = shouldReward ? [...log.rewarded, action.habitId] : log.rewarded;
      return {
        state: {
          ...state,
          game: shouldReward ? credit(game, HABIT_REWARD) : game,
          habits: { date: log.date, done, rewarded },
        },
        effect: { coins: shouldReward ? HABIT_REWARD : 0 },
      };
    }

    case 'upgrade/buy': {
      const cost = upgradeCost(game, action.upgradeId);
      if (cost === null) throw new GameError('MAX_LEVEL', 'Достигнут максимальный уровень');
      const paid = spend(game, cost);
      const upgrades = { ...paid.upgrades, [action.upgradeId]: paid.upgrades[action.upgradeId] + 1 };
      // Увеличение запаса энергии сразу добавляет новые 250 единиц.
      const energyBonus = action.upgradeId === 'energy' ? 250 : 0;
      return {
        state: { ...state, game: { ...paid, upgrades, energy: paid.energy + energyBonus } },
        effect: {},
      };
    }

    case 'product/buy': {
      const price = coinPrice(action.productId);
      if (price === null) throw new GameError('NOT_FOUND', 'Продукт не найден');
      assertNotOwned(state, action.productId);
      const purchase = makePurchase(action.productId, 'coins', ctx);
      return {
        state: { ...state, game: spend(game, price), purchases: [purchase, ...state.purchases] },
        effect: { purchase },
      };
    }
  }
}

/** Цена в нутриках для любого товара: продукта магазина или курса. */
export function coinPrice(id: string): number | null {
  return PRODUCTS.find((p) => p.id === id)?.price ?? findCourse(id)?.priceCoins ?? null;
}

function assertNotOwned(state: UserState, productId: string) {
  if (state.purchases.some((p) => p.productId === productId)) {
    throw new GameError('ALREADY_PURCHASED', 'Этот продукт уже у вас');
  }
}

function makePurchase(productId: string, method: Purchase['method'], ctx: ReduceContext): Purchase {
  return {
    id: ctx.genId(),
    productId,
    code: `NL-${ctx.genId().replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()}`,
    purchasedAt: ctx.now,
    method,
  };
}

/**
 * Выдача курса после успешной оплаты рублями (вызывается только сервером
 * по событию successful_payment от Telegram). Повторная оплата не создаёт дубль.
 */
export function grantPaidCourse(state: UserState, courseId: string, ctx: ReduceContext): ActionResult {
  if (!findCourse(courseId)) throw new GameError('NOT_FOUND', 'Курс не найден');
  const existing = state.purchases.find((p) => p.productId === courseId);
  if (existing) return { state, effect: { purchase: existing } };
  const purchase = makePurchase(courseId, 'rub', ctx);
  return { state: { ...state, purchases: [purchase, ...state.purchases] }, effect: { purchase } };
}
