import type { ActionResult, GameAction, GameErrorCode, UserState } from '@shared/types';

export type ApiErrorCode = GameErrorCode | 'NETWORK' | 'UNAUTHORIZED' | 'SERVER' | 'TIMEOUT';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface LeadMagnetDelivery {
  /** true — гид отправлен в чат с ботом. */
  sentToChat: boolean;
}

/**
 * Контракт между Mini App и бэкендом. Реализации:
 *  - MockApiClient — всё хранится на устройстве (демо, GitHub Pages);
 *  - HttpApiClient — сервер из папки /server с проверкой initData.
 */
export interface ApiClient {
  readonly mode: 'mock' | 'remote';
  bootstrap(): Promise<UserState>;
  dispatch(action: GameAction): Promise<ActionResult>;
  sendLeadMagnet(): Promise<LeadMagnetDelivery>;
  /** Сброс прогресса — доступен только в демо-режиме. */
  reset?(): Promise<UserState>;
}
