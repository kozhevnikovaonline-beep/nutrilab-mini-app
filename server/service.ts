import { randomUUID } from 'node:crypto';
import { REFERRAL_REWARD, TASKS } from '../shared/catalog';
import { GameError, createInitialState, parseAction, reduce } from '../shared/game';
import type { ActionResult, UserProfile, UserState } from '../shared/types';
import type { Db } from './db';
import type { VerifiedInitData } from './telegramAuth';

export interface ServiceDeps {
  isChannelMember(userId: number): Promise<boolean>;
  notify?(userId: number, html: string): Promise<unknown>;
  pendingReferral?(userId: number): string | undefined;
}

const toProfile = (u: VerifiedInitData['user']): UserProfile => ({
  id: u.id,
  firstName: u.first_name.slice(0, 64),
  lastName: u.last_name?.slice(0, 64),
  username: u.username,
  photoUrl: u.photo_url,
  languageCode: u.language_code,
});

/** Последовательное выполнение операций одного пользователя (исключает гонки при параллельных запросах). */
const locks = new Map<number, Promise<unknown>>();
export function withUserLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(userId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  locks.set(userId, next);
  // Очистка не должна порождать необработанный rejection: ошибку получает вызывающий код через `next`.
  const cleanup = () => {
    if (locks.get(userId) === next) locks.delete(userId);
  };
  next.then(cleanup, cleanup);
  return next;
}

export function bootstrapUser(db: Db, auth: VerifiedInitData, deps: ServiceDeps, now = Date.now()): UserState {
  const userId = auth.user.id;
  const profile = toProfile(auth.user);
  const existing = db.get(userId);
  if (existing) {
    const state = { ...existing.state, profile };
    db.set(userId, { ...existing, state });
    return state;
  }

  let state = createInitialState(profile, now);
  const refParam = auth.startParam ?? deps.pendingReferral?.(userId);
  const inviterId = Number(/^ref_(\d{1,15})$/.exec(refParam ?? '')?.[1]);
  const inviter = Number.isSafeInteger(inviterId) && inviterId !== userId ? db.get(inviterId) : undefined;

  if (inviter) {
    state = { ...state, referredBy: inviterId };
    const g = inviter.state.game;
    db.set(inviterId, {
      ...inviter,
      state: {
        ...inviter.state,
        referrals: inviter.state.referrals + 1,
        game: { ...g, balance: g.balance + REFERRAL_REWARD, totalEarned: g.totalEarned + REFERRAL_REWARD },
      },
    });
    void deps
      .notify?.(inviterId, `🤝 По вашей ссылке присоединился новый участник! +${REFERRAL_REWARD} нутриков уже на балансе.`)
      .catch(() => undefined);
  }

  db.set(userId, { state, botStarted: false, followUps: {} });
  return state;
}

export async function applyAction(db: Db, userId: number, rawAction: unknown, deps: ServiceDeps): Promise<ActionResult> {
  const record = db.get(userId);
  if (!record) throw new GameError('NOT_FOUND', 'Пользователь не найден — перезапустите приложение');
  const action = parseAction(rawAction);

  let verified = true;
  if (action.type === 'task/claim' && TASKS.find((t) => t.id === action.taskId)?.kind === 'channel') {
    verified = await deps.isChannelMember(userId);
  }

  const result = reduce(record.state, action, {
    now: Date.now(),
    genId: randomUUID,
    isTaskVerified: () => verified,
  });
  db.set(userId, { ...db.get(userId)!, state: result.state });
  return result;
}
