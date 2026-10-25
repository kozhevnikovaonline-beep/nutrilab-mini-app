import { describe, expect, it } from 'vitest';
import { BASE_MAX_ENERGY, DAILY_REWARDS, HABIT_REWARD, PRODUCTS, QUIZ_REWARD, UPGRADES } from './catalog';
import { GameError, createInitialState, dailyStatus, parseAction, reduce, regenEnergy } from './game';
import { QUESTION_COUNT } from './quiz';
import type { AnswerValue, GameAction, UserState } from './types';

const T0 = Date.UTC(2026, 9, 25, 10, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
let seq = 0;
const ctx = (now = T0) => ({ now, genId: () => `id-${++seq}-abcdef` });
const fresh = () => createInitialState({ id: 1, firstName: 'Анна' }, T0);
const act = (s: UserState, a: GameAction, now = T0) => reduce(s, a, ctx(now));
const rich = (balance: number) => {
  const s = fresh();
  return { ...s, game: { ...s.game, balance } };
};

describe('тапы и энергия', () => {
  it('начисляет монеты и тратит энергию', () => {
    const { state, effect } = act(fresh(), { type: 'taps', count: 10 });
    expect(effect.coins).toBe(10);
    expect(state.game.balance).toBe(10);
    expect(state.game.energy).toBe(BASE_MAX_ENERGY - 10);
    expect(state.game.totalTaps).toBe(10);
  });

  it('не даёт тапнуть больше, чем позволяет энергия (защита от накрутки)', () => {
    const { state } = act(fresh(), { type: 'taps', count: 400 });
    const r = act(state, { type: 'taps', count: 400 });
    expect(r.effect.coins).toBe(100);
    expect(() => act(r.state, { type: 'taps', count: 1 })).toThrow(GameError);
  });

  it('восстанавливает энергию со временем, но не выше максимума', () => {
    const { state } = act(fresh(), { type: 'taps', count: 100 });
    expect(regenEnergy(state.game, T0 + 10_000).energy).toBe(BASE_MAX_ENERGY - 100 + 20);
    expect(regenEnergy(state.game, T0 + DAY).energy).toBe(BASE_MAX_ENERGY);
  });

  it('мульти-тап увеличивает награду за тап', () => {
    const { state } = act(rich(5_000), { type: 'upgrade/buy', upgradeId: 'multitap' });
    expect(state.game.balance).toBe(5_000 - UPGRADES.multitap.costs[0]);
    expect(act(state, { type: 'taps', count: 1 }).effect.coins).toBe(2);
  });

  it('запрещает покупку буста без денег и выше максимального уровня', () => {
    expect(() => act(fresh(), { type: 'upgrade/buy', upgradeId: 'energy' })).toThrow(/Не хватает/);
    const maxed = rich(1_000_000);
    maxed.game.upgrades.energy = UPGRADES.energy.costs.length;
    expect(() => act(maxed, { type: 'upgrade/buy', upgradeId: 'energy' })).toThrow(/максимальный/);
  });
});

describe('тест и задания', () => {
  const answers = Array<AnswerValue>(QUESTION_COUNT).fill(1);

  it('начисляет награду только за первое прохождение', () => {
    const first = act(fresh(), { type: 'quiz/submit', answers });
    expect(first.effect.coins).toBe(QUIZ_REWARD);
    expect(first.state.quiz).toMatchObject({ score: 25, tier: 'attention', attempts: 1 });
    expect(first.state.tasks.quiz).toBe(T0);
    const second = act(first.state, { type: 'quiz/submit', answers });
    expect(second.effect.coins).toBe(0);
    expect(second.state.quiz?.attempts).toBe(2);
  });

  it('гид можно забрать только после теста и только один раз', () => {
    expect(() => act(fresh(), { type: 'task/claim', taskId: 'guide' })).toThrow(/не выполнено/);
    const { state } = act(fresh(), { type: 'quiz/submit', answers });
    const claimed = act(state, { type: 'task/claim', taskId: 'guide' });
    expect(claimed.effect.coins).toBe(200);
    expect(() => act(claimed.state, { type: 'task/claim', taskId: 'guide' })).toThrow(/уже получена/);
  });

  it('проверка подписки на канал учитывает внешнюю верификацию', () => {
    expect(() => reduce(fresh(), { type: 'task/claim', taskId: 'channel' }, { ...ctx(), isTaskVerified: () => false })).toThrow(
      /не выполнено/,
    );
    expect(reduce(fresh(), { type: 'task/claim', taskId: 'channel' }, { ...ctx(), isTaskVerified: () => true }).effect.coins).toBe(300);
  });
});

describe('ежедневный бонус', () => {
  it('растёт по серии и сбрасывается при пропуске дня', () => {
    let s = act(fresh(), { type: 'daily/claim' }).state;
    expect(s.game.balance).toBe(DAILY_REWARDS[0]);
    expect(() => act(s, { type: 'daily/claim' })).toThrow(/уже получен/);
    s = act(s, { type: 'daily/claim' }, T0 + DAY).state;
    expect(s.daily.streak).toBe(2);
    expect(dailyStatus(s, T0 + 3 * DAY).nextStreak).toBe(1);
  });
});

describe('привычки', () => {
  it('начисляет монеты один раз за привычку в день', () => {
    let r = act(fresh(), { type: 'habit/toggle', habitId: 'water' });
    expect(r.effect.coins).toBe(HABIT_REWARD);
    r = act(r.state, { type: 'habit/toggle', habitId: 'water' });
    expect(r.state.habits.done).toEqual([]);
    r = act(r.state, { type: 'habit/toggle', habitId: 'water' });
    expect(r.effect.coins).toBe(0);
    // Новый день начинается с чистого чек-листа — награда снова доступна.
    const tomorrow = act(r.state, { type: 'habit/toggle', habitId: 'water' }, T0 + DAY);
    expect(tomorrow.effect.coins).toBe(HABIT_REWARD);
    expect(tomorrow.state.habits.done).toEqual(['water']);
  });
});

describe('магазин', () => {
  const product = PRODUCTS[0];

  it('списывает монеты и выдаёт код', () => {
    const { state, effect } = act(rich(product.price + 5), { type: 'product/buy', productId: product.id });
    expect(state.game.balance).toBe(5);
    expect(effect.purchase?.code).toMatch(/^NL-[A-Z0-9]{6}$/);
    const stillRich = { ...state, game: { ...state.game, balance: 1e6 } };
    expect(() => act(stillRich, { type: 'product/buy', productId: product.id })).toThrow(/уже у вас/);
  });

  it('не продаёт без достаточного баланса и неизвестные товары', () => {
    expect(() => act(fresh(), { type: 'product/buy', productId: product.id })).toThrow(/Не хватает/);
    expect(() => act(rich(1e6), { type: 'product/buy', productId: 'nope' })).toThrow(/не найден/);
  });
});

describe('parseAction', () => {
  it('пропускает корректные и отклоняет мусорные данные', () => {
    expect(parseAction({ type: 'taps', count: 5 })).toEqual({ type: 'taps', count: 5 });
    for (const bad of [null, 'x', { type: 'taps', count: -1 }, { type: 'taps', count: 1e6 }, { type: 'taps', count: 1.5 }, { type: 'upgrade/buy', upgradeId: 'god' }, { type: 'hack' }, { type: 'quiz/submit', answers: [1] }]) {
      expect(() => parseAction(bad)).toThrow(GameError);
    }
  });
});
