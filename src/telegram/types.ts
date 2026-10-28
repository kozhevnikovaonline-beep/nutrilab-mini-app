/**
 * Типизация используемой части Telegram Web Apps API (Bot API 8.0+).
 * https://core.telegram.org/bots/webapps
 */

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface TgThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TgBottomButton {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  setParams(params: {
    text?: string;
    color?: string;
    text_color?: string;
    is_active?: boolean;
    is_visible?: boolean;
    has_shine_effect?: boolean;
    position?: 'left' | 'right' | 'top' | 'bottom';
  }): TgBottomButton;
  onClick(cb: () => void): TgBottomButton;
  offClick(cb: () => void): TgBottomButton;
  show(): TgBottomButton;
  hide(): TgBottomButton;
  showProgress(leaveActive?: boolean): TgBottomButton;
  hideProgress(): TgBottomButton;
}

export interface TgBackButton {
  isVisible: boolean;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
  show(): void;
  hide(): void;
}

export interface TgPopupButton {
  id?: string;
  type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
  text?: string;
}

export interface TgCloudStorage {
  setItem(key: string, value: string, cb?: (error: string | null, ok?: boolean) => void): void;
  getItem(key: string, cb: (error: string | null, value?: string) => void): void;
  removeItem(key: string, cb?: (error: string | null, ok?: boolean) => void): void;
}

export type TgEvent =
  | 'themeChanged'
  | 'viewportChanged'
  | 'fullscreenChanged'
  | 'fullscreenFailed'
  | 'safeAreaChanged'
  | 'contentSafeAreaChanged'
  | 'activated'
  | 'deactivated';

export interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: TgUser; start_param?: string; auth_date?: number; hash?: string };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TgThemeParams;
  isExpanded: boolean;
  isFullscreen?: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  MainButton: TgBottomButton;
  SecondaryButton?: TgBottomButton;
  BackButton: TgBackButton;
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  CloudStorage: TgCloudStorage;
  ready(): void;
  expand(): void;
  close(): void;
  requestFullscreen?(): void;
  disableVerticalSwipes?(): void;
  enableClosingConfirmation?(): void;
  isVersionAtLeast(version: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  showPopup(params: { title?: string; message: string; buttons?: TgPopupButton[] }, cb?: (id: string) => void): void;
  showConfirm(message: string, cb?: (ok: boolean) => void): void;
  showAlert(message: string, cb?: () => void): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  requestWriteAccess?(cb?: (granted: boolean) => void): void;
  openInvoice?(url: string, cb?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
  onEvent(event: TgEvent, cb: () => void): void;
  offEvent(event: TgEvent, cb: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}
