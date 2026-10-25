import { startParam, telegramProfile, tg } from '../telegram/webapp';
import { HttpApiClient } from './httpClient';
import { MockApiClient } from './mockClient';
import type { ApiClient } from './types';

export * from './types';

/**
 * Выбор реализации API:
 *  - задан VITE_API_URL и приложение открыто в Telegram → реальный сервер;
 *  - иначе → мок-режим (данные на устройстве + Telegram CloudStorage).
 */
export function createApiClient(): ApiClient {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiUrl && tg?.initData) return new HttpApiClient(apiUrl, tg.initData, startParam());
  return new MockApiClient(telegramProfile());
}

export const api = createApiClient();
