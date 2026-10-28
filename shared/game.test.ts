import { describe, expect, it } from 'vitest';
import { BASE_MAX_ENERGY, DAILY_REWARDS, HABIT_REWARD, PRODUCTS, QUIZ_REWARD, UPGRADES } from './catalog';
import { COURSES, findCourse } from './courses';
import { coinDiscount, isValidCoinSpend, makeCoursePayload, parseCoursePayload } from './pricing';
import { GameError, coinPrice, createInitialState, dailyStatus, grantPaidCourse, parseAction, reduce, regenEnergy } from './game';
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

describe('курсы: рубли + скидка нутриками', () => {
  const course = findCourse('course-mini')!; // 7 990 ₽

  it('не продаются целиком за нутрики — только материалы', () => {
    expect(coinPrice(course.id)).toBeNull();
    expect(() => act(rich(1e7), { type: 'product/buy', productId: course.id })).toThrow(/не найден/);
    expect(coinPrice(PRODUCTS[0].id)).toBe(PRODUCTS[0].price);
  });

  it('скидка нутриками — не больше 30% цены, 1 нутрик = 1 ₽', () => {
    expect(coinDiscount(7990, 1e9)).toEqual({ maxRub: 2397, rub: 2397, coins: 2397, finalRub: 5593 });
    expect(coinDiscount(7990, 1000)).toEqual({ maxRub: 2397, rub: 1000, coins: 1000, finalRub: 6990 });
    expect(coinDiscount(7990, 0).rub).toBe(0);
    expect(isValidCoinSpend(7990, 2397)).toBe(true);
    expect(isValidCoinSpend(7990, 2398)).toBe(false); // больше 30%
    expect(isValidCoinSpend(7990, 10.5)).toBe(false); // только целые нутрики
  });

  it('после оплаты рублями выдаются и списывают заявленные нутрики, без дублей', () => {
    const start = rich(10_000);
    const paid = grantPaidCourse(start, course.id, ctx(), 2397);
    expect(paid.state.game.balance).toBe(10_000 - 2397);
    expect(paid.effect.purchase).toMatchObject({ productId: course.id, method: 'rub', coinsSpent: 2397 });
    const again = grantPaidCourse(paid.state, course.id, ctx(), 2397);
    expect(again.state.purchases).toHaveLength(1);
    expect(again.state.game.balance).toBe(paid.state.game.balance);
    expect(grantPaidCourse(start, course.id, ctx()).state.game.balance).toBe(10_000);
    expect(() => grantPaidCourse(start, course.id, ctx(), 9000)).toThrow(/скидка/);
    expect(() => grantPaidCourse(start, 'nope', ctx())).toThrow(/не найден/);
  });

  it('payload счёта кодирует курс, пользователя и нутрики', () => {
    const payload = makeCoursePayload({ courseId: 'course-mini', userId: 42, coins: 999 });
    expect(parseCoursePayload(payload)).toEqual({ courseId: 'course-mini', userId: 42, coins: 999 });
    expect(parseCoursePayload('course:x:1')).toBeNull();
    expect(parseCoursePayload('hack')).toBeNull();
  });

  it('консультация и разбор рациона перенесены в раздел «Курсы»', () => {
    for (const id of ['consultation', 'diet-review', 'sugar-course', 'course-reset']) {
      expect(findCourse(id)).toBeDefined();
      expect(PRODUCTS.find((p) => p.id === id)).toBeUndefined();
    }
    expect(PRODUCTS.every((p) => p.category === 'materials')).toBe(true);
  });

  it('у каждого курса корректная цена и программа', () => {
    for (const c of COURSES) {
      expect(Number.isInteger(c.priceRub) && c.priceRub > 0).toBe(true);
      expect(c.program.length).toBeGreaterThan(0);
      expect(c.title.length).toBeLessThanOrEqual(32); // ограничение title в счёте Telegram
    }
    expect(new Set(COURSES.map((c) => c.id)).size).toBe(COURSES.length);
  });
});
