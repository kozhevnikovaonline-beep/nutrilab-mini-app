import type { UserProfile } from '@shared/types';
import type { TgWebApp } from './types';

/**
 * Единая точка доступа к Telegram WebApp. Вне Telegram (обычный браузер)
 * все методы безопасно деградируют: попапы → window.confirm, ссылки → window.open и т. д.
 */

const webApp: TgWebApp | null = (() => {
  const wa = window.Telegram?.WebApp;
  // SDK подключается и в браузере, но initData есть только внутри Telegram.
  return wa && wa.initData ? wa : null;
})();

export const tg = webApp;
export const isTelegram = webApp !== null;

const MOBILE_PLATFORMS = new Set(['ios', 'android', 'android_x']);

export const BRAND_COLORS = {
  light: { header: '#0f3d1e', background: '#f2f5ec', bottomBar: '#f2f5ec' },
  dark: { header: '#0a2412', background: '#0b110c', bottomBar: '#0b110c' },
} as const;

export function colorScheme(): 'light' | 'dark' {
  if (webApp) return webApp.colorScheme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyChromeColors() {
  const scheme = colorScheme();
  document.documentElement.dataset.theme = scheme;
  if (!webApp) return;
  const colors = BRAND_COLORS[scheme];
  try {
    webApp.setHeaderColor(colors.header);
    webApp.setBackgroundColor(colors.background);
    webApp.setBottomBarColor?.(colors.bottomBar);
  } catch {
    // Старые клиенты могут не поддерживать произвольные цвета — не критично.
  }
}

/** Инициализация: полноэкранный режим, цвета, запрет закрытия свайпом во время тапов. */
export function initTelegram() {
  applyChromeColors();
  if (!webApp) {
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyChromeColors);
    return;
  }
  webApp.ready();
  webApp.expand();
  if (webApp.isVersionAtLeast('7.7')) webApp.disableVerticalSwipes?.();
  // Fullscreen на телефонах; на десктопе он растянул бы окно на весь монитор.
  if (webApp.isVersionAtLeast('8.0') && MOBILE_PLATFORMS.has(webApp.platform) && !webApp.isFullscreen) {
    try {
      webApp.requestFullscreen?.();
    } catch {
      // fullscreenFailed — остаёмся в expanded-режиме.
    }
  }
  webApp.onEvent('themeChanged', applyChromeColors);
  document.documentElement.classList.toggle('tg-mobile', MOBILE_PLATFORMS.has(webApp.platform));
}

/** Профиль пользователя из initDataUnsafe (только для отображения; доверять можно лишь серверной проверке). */
export function telegramProfile(): UserProfile {
  const u = webApp?.initDataUnsafe.user;
  if (u) {
    return {
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      username: u.username,
      photoUrl: u.photo_url,
      languageCode: u.language_code,
    };
  }
  return { id: 0, firstName: 'Гость' };
}

export const startParam = (): string | undefined => webApp?.initDataUnsafe.start_param;

let hapticsEnabled = true;
export const setHapticsEnabled = (value: boolean) => {
  hapticsEnabled = value;
};

export const haptic = {
  tap() {
    if (hapticsEnabled) webApp?.HapticFeedback.impactOccurred('light');
  },
  select() {
    if (hapticsEnabled) webApp?.HapticFeedback.selectionChanged();
  },
  success() {
    if (hapticsEnabled) webApp?.HapticFeedback.notificationOccurred('success');
  },
  error() {
    if (hapticsEnabled) webApp?.HapticFeedback.notificationOccurred('error');
  },
  warning() {
    if (hapticsEnabled) webApp?.HapticFeedback.notificationOccurred('warning');
  },
};

export function confirmAction(message: string): Promise<boolean> {
  if (webApp?.isVersionAtLeast('6.2')) {
    return new Promise((resolve) => webApp.showConfirm(message, (ok) => resolve(ok)));
  }
  return Promise.resolve(window.confirm(message));
}

/** Разрешение боту писать пользователю (нужно, если человек открыл приложение по ссылке, не запуская бота). */
export function requestWriteAccess(): Promise<boolean> {
  if (!webApp?.requestWriteAccess || !webApp.isVersionAtLeast('6.9')) return Promise.resolve(false);
  return new Promise((resolve) => webApp.requestWriteAccess!((granted) => resolve(granted)));
}

export function openLink(url: string) {
  if (!/^https:\/\//.test(url)) return;
  if (webApp && /^https:\/\/t\.me\//.test(url)) webApp.openTelegramLink(url);
  else if (webApp) webApp.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

/** Открывает нативный диалог «Поделиться» Telegram со ссылкой-приглашением. */
export function shareLink(url: string, text: string) {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (webApp) webApp.openTelegramLink(shareUrl);
  else if (navigator.share) navigator.share({ url, text }).catch(() => undefined);
  else window.open(shareUrl, '_blank', 'noopener,noreferrer');
}
