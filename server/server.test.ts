import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REFERRAL_REWARD } from '../shared/catalog';
import { Db } from './db';
import { applyAction, bootstrapUser, withUserLock, type ServiceDeps } from './service';
import { InitDataError, signInitData, verifyInitData } from './telegramAuth';

const TOKEN = '123456:TEST-token';
const now = Math.floor(Date.now() / 1000);
const user = (id: number) => JSON.stringify({ id, first_name: `User${id}` });

describe('verifyInitData', () => {
  it('принимает корректно подписанные данные', () => {
    const initData = signInitData({ auth_date: String(now), user: user(42), start_param: 'ref_7' }, TOKEN);
    const r = verifyInitData(initData, TOKEN, 3600, now);
    expect(r.user.id).toBe(42);
    expect(r.startParam).toBe('ref_7');
  });

  it('отклоняет подделку, чужой токен и устаревшие данные', () => {
    const initData = signInitData({ auth_date: String(now), user: user(42) }, TOKEN);
    const tampered = initData.replace('User42', 'Admin');
    expect(() => verifyInitData(tampered, TOKEN, 3600, now)).toThrow(InitDataError);
    expect(() => verifyInitData(initData, '999:other', 3600, now)).toThrow(InitDataError);
    expect(() => verifyInitData(initData, TOKEN, 3600, now + 7200)).toThrow(/устарели/);
    expect(() => verifyInitData('', TOKEN, 3600, now)).toThrow(InitDataError);
  });
});

describe('service', () => {
  const deps: ServiceDeps = { isChannelMember: async () => false };
  const auth = (id: number, startParam?: string) => ({
    user: { id, first_name: `User${id}` },
    authDate: now,
    startParam,
  });
  const newDb = () => new Db(path.join(mkdtempSync(path.join(tmpdir(), 'nutrilab-')), 'db.json'));

  it('создаёт пользователя и начисляет реферальный бонус пригласившему один раз', () => {
    const db = newDb();
    bootstrapUser(db, auth(1), deps);
    const invited = bootstrapUser(db, auth(2, 'ref_1'), deps);
    expect(invited.referredBy).toBe(1);
    expect(db.get(1)!.state.referrals).toBe(1);
    expect(db.get(1)!.state.game.balance).toBe(REFERRAL_REWARD);
    // Повторный вход не начисляет бонус снова.
    bootstrapUser(db, auth(2, 'ref_1'), deps);
    expect(db.get(1)!.state.referrals).toBe(1);
    // Самоприглашение игнорируется.
    expect(bootstrapUser(db, auth(3, 'ref_3'), deps).referredBy).toBeUndefined();
  });

  it('проверяет подписку на канал на сервере', async () => {
    const db = newDb();
    bootstrapUser(db, auth(5), deps);
    await expect(applyAction(db, 5, { type: 'task/claim', taskId: 'channel' }, deps)).rejects.toThrow(/не выполнено/);
    const ok = await applyAction(db, 5, { type: 'task/claim', taskId: 'channel' }, { isChannelMember: async () => true });
    expect(ok.effect.coins).toBe(300);
  });

  it('ошибка внутри блокировки пользователя не ломает последующие запросы', async () => {
    const db = newDb();
    bootstrapUser(db, auth(11), deps);
    await expect(withUserLock(11, () => applyAction(db, 11, { type: 'taps', count: 100_000 }, deps))).rejects.toThrow();
    const ok = await withUserLock(11, () => applyAction(db, 11, { type: 'taps', count: 3 }, deps));
    expect(ok.state.game.balance).toBe(3);
  });

  it('сохраняет и загружает данные с диска', async () => {
    const db = newDb();
    bootstrapUser(db, auth(9), deps);
    await applyAction(db, 9, { type: 'taps', count: 25 }, deps);
    await db.flush();
    const reloaded = new Db((db as unknown as { file: string }).file);
    await reloaded.load();
    expect(reloaded.get(9)!.state.game.balance).toBe(25);
  });
});
