import { useEffect, useRef } from 'react';
import type { TgBottomButton } from './types';
import { tg } from './webapp';

/**
 * Управление нативной кнопкой «Назад» Telegram.
 * Передайте null, чтобы скрыть кнопку.
 */
export function useBackButton(onBack: (() => void) | null) {
  const handler = useRef(onBack);
  handler.current = onBack;
  const visible = onBack !== null;

  useEffect(() => {
    if (!tg || !visible) return;
    const cb = () => handler.current?.();
    tg.BackButton.onClick(cb);
    tg.BackButton.show();
    return () => {
      tg?.BackButton.offClick(cb);
      tg?.BackButton.hide();
    };
  }, [visible]);
}

export interface BottomButtonOptions {
  text: string;
  onClick: () => void;
  visible?: boolean;
  disabled?: boolean;
  loading?: boolean;
  shine?: boolean;
  /** Свой цвет кнопки (по умолчанию — фирменный для типа кнопки). */
  color?: string;
}

const COLORS = {
  main: { bg: '#22a447', text: '#ffffff' },
  secondary: { bg: '#efecff', text: '#7464ec' },
  disabled: { bg: '#b9c2bb', text: '#ffffff' },
};

function useBottomButton(kind: 'main' | 'secondary', opts: BottomButtonOptions) {
  const { text, onClick, visible = true, disabled = false, loading = false, shine = false, color } = opts;
  const handler = useRef(onClick);
  handler.current = onClick;
  const button: TgBottomButton | undefined =
    kind === 'main' ? tg?.MainButton : tg?.isVersionAtLeast('7.10') ? tg.SecondaryButton : undefined;

  useEffect(() => {
    if (!button || !visible) return;
    const cb = () => handler.current();
    button.onClick(cb);
    return () => {
      button.offClick(cb);
      button.hideProgress();
      button.hide();
    };
  }, [button, visible]);

  useEffect(() => {
    if (!button || !visible) return;
    const colors = disabled ? COLORS.disabled : color ? { bg: color, text: '#ffffff' } : COLORS[kind];
    button.setParams({
      text,
      color: colors.bg,
      text_color: colors.text,
      is_active: !disabled && !loading,
      is_visible: true,
      has_shine_effect: shine && !disabled,
      ...(kind === 'secondary' ? { position: 'top' } : {}),
    });
    if (loading) button.showProgress(false);
    else button.hideProgress();
  }, [button, kind, text, disabled, loading, visible, shine, color]);

  return Boolean(button);
}

/**
 * Нативная нижняя кнопка Telegram (MainButton). Возвращает true, если используется
 * нативная кнопка — тогда экран не должен рисовать свою HTML-кнопку.
 */
export const useMainButton = (opts: BottomButtonOptions) => useBottomButton('main', opts);

/** Дополнительная нативная кнопка (SecondaryButton, Bot API 7.10+). */
export const useSecondaryButton = (opts: BottomButtonOptions) => useBottomButton('secondary', opts);
