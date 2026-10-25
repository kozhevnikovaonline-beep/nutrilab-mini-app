import { useEffect, useRef } from 'react';
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

export interface MainButtonOptions {
  text: string;
  onClick: () => void;
  visible?: boolean;
  disabled?: boolean;
  loading?: boolean;
  shine?: boolean;
}

const MAIN_BUTTON_COLOR = '#1f6b34';

/**
 * Нативная нижняя кнопка Telegram (MainButton). Возвращает true, если используется
 * нативная кнопка — тогда экран не должен рисовать свою HTML-кнопку.
 */
export function useMainButton({ text, onClick, visible = true, disabled = false, loading = false, shine = false }: MainButtonOptions) {
  const handler = useRef(onClick);
  handler.current = onClick;

  useEffect(() => {
    if (!tg || !visible) return;
    const cb = () => handler.current();
    const button = tg.MainButton;
    button.onClick(cb);
    return () => {
      button.offClick(cb);
      button.hideProgress();
      button.hide();
    };
  }, [visible]);

  useEffect(() => {
    if (!tg || !visible) return;
    const button = tg.MainButton;
    button.setParams({
      text,
      color: disabled ? '#9aa79a' : MAIN_BUTTON_COLOR,
      text_color: '#ffffff',
      is_active: !disabled && !loading,
      is_visible: true,
      has_shine_effect: shine,
    });
    if (loading) button.showProgress(false);
    else button.hideProgress();
  }, [text, disabled, loading, visible, shine]);

  return tg !== null;
}
