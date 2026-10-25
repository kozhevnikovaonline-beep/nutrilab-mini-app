import { GameError, createInitialState, migrateState, reduce } from '@shared/game';
import type { ActionResult, GameAction, UserProfile, UserState } from '@shared/types';
import { tg } from '../telegram/webapp';
import { ApiError, type ApiClient, type LeadMagnetDelivery } from './types';

/**
 * Мок-бэкенд: та же игровая логика, что и на сервере, но состояние живёт
 * в localStorage и синхронизируется в Telegram CloudStorage (между устройствами пользователя).
 */

const STORAGE_PREFIX = 'nutrilab:state:v1:';
const CLOUD_KEY = 'state_v1';
/** Лимит Telegram CloudStorage на одно значение. */
const CLOUD_VALUE_LIMIT = 4096;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readCloud(): Promise<string | null> {
  if (!tg?.isVersionAtLeast('6.9')) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 1500);
    tg!.CloudStorage.getItem(CLOUD_KEY, (error, value) => {
      clearTimeout(timer);
      resolve(error || !value ? null : value);
    });
  });
}

function writeCloud(value: string) {
  if (!tg?.isVersionAtLeast('6.9') || value.length > CLOUD_VALUE_LIMIT) return;
  tg.CloudStorage.setItem(CLOUD_KEY, value);
}

function safeParse(raw: string | null): UserState | null {
  if (!raw) return null;
  try {
    return migrateState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export class MockApiClient implements ApiClient {
  readonly mode = 'mock' as const;
  private state: UserState | null = null;
  private cloudTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly profile: UserProfile) {}

  private get storageKey() {
    return STORAGE_PREFIX + this.profile.id;
  }

  private persist(state: UserState) {
    this.state = state;
    const raw = JSON.stringify(state);
    try {
      localStorage.setItem(this.storageKey, raw);
    } catch {
      // Приватный режим / переполнение — продолжаем работать в памяти.
    }
    clearTimeout(this.cloudTimer);
    this.cloudTimer = setTimeout(() => writeCloud(raw), 1500);
  }

  async bootstrap(): Promise<UserState> {
    await delay(400);
    let stored: UserState | null = null;
    try {
      stored = safeParse(localStorage.getItem(this.storageKey));
    } catch {
      stored = null;
    }
    // Берём более «свежее» из локального и облачного состояния.
    const cloud = safeParse(await readCloud());
    if (cloud && (!stored || cloud.game.totalEarned > stored.game.totalEarned)) stored = cloud;

    const state = stored
      ? { ...stored, profile: { ...stored.profile, ...this.profile } }
      : createInitialState(this.profile, Date.now());
    this.persist(state);
    return state;
  }

  async dispatch(action: GameAction): Promise<ActionResult> {
    if (!this.state) throw new ApiError('SERVER', 'Состояние ещё не загружено');
    // Тапы отправляются часто — не добавляем им искусственную задержку.
    if (action.type !== 'taps') await delay(250);
    try {
      const result = reduce(this.state, action, { now: Date.now(), genId });
      this.persist(result.state);
      return result;
    } catch (err) {
      if (err instanceof GameError) throw new ApiError(err.code, err.message);
      throw new ApiError('SERVER', 'Не удалось выполнить действие');
    }
  }

  async sendLeadMagnet(): Promise<LeadMagnetDelivery> {
    await delay(300);
    // Без сервера бот не может написать пользователю — гид доступен внутри приложения.
    return { sentToChat: false };
  }

  async reset(): Promise<UserState> {
    const state = createInitialState(this.profile, Date.now());
    this.persist(state);
    return state;
  }
}
