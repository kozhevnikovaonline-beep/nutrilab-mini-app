import type { ActionResult, GameAction, UserState } from '@shared/types';
import { ApiError, type ApiClient, type ApiErrorCode, type LeadMagnetDelivery } from './types';

const TIMEOUT_MS = 10_000;

/**
 * Клиент реального бэкенда (папка /server).
 * Каждый запрос подписан initData — сервер проверяет HMAC-подпись Telegram,
 * поэтому подделать пользователя или баланс с клиента невозможно.
 */
export class HttpApiClient implements ApiClient {
  readonly mode = 'remote' as const;

  constructor(
    private readonly baseUrl: string,
    private readonly initData: string,
    private readonly startParam?: string,
  ) {}

  private async request<T>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `tma ${this.initData}` },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      throw new ApiError(aborted ? 'TIMEOUT' : 'NETWORK', aborted ? 'Сервер не отвечает' : 'Нет соединения с сервером');
    } finally {
      clearTimeout(timer);
    }

    const payload = (await response.json().catch(() => null)) as
      | { ok: true; data: T }
      | { ok: false; error: { code: ApiErrorCode; message: string } }
      | null;

    if (!payload) throw new ApiError('SERVER', `Ошибка сервера (${response.status})`);
    if (!payload.ok) throw new ApiError(payload.error.code, payload.error.message);
    return payload.data;
  }

  bootstrap() {
    return this.request<UserState>('/api/bootstrap', { startParam: this.startParam });
  }

  dispatch(action: GameAction) {
    return this.request<ActionResult>('/api/action', action);
  }

  createInvoice(courseId: string, useCoins: boolean) {
    return this.request<{ invoiceUrl: string }>('/api/invoice', { courseId, useCoins });
  }

  sendLeadMagnet() {
    return this.request<LeadMagnetDelivery>('/api/lead-magnet');
  }
}
