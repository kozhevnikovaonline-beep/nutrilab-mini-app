import { Component, type ReactNode } from 'react';
import type { UserProfile } from '@shared/types';
import { useMainButton, useSecondaryButton } from '../telegram/hooks';
import { isTelegram } from '../telegram/webapp';
import { useApp } from '../store/appStore';
import { formatCoins } from '../lib/format';
import { Coin } from './Coin';
import { Icon } from './Icon';

export function Avatar({ profile, size = 46 }: { profile: UserProfile; size?: number }) {
  return (
    <div className="avatar" style={{ width: size, height: size }}>
      {profile.photoUrl ? (
        <img src={profile.photoUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span>{profile.firstName.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}

export function BalanceChip() {
  const balance = useApp((s) => s.user?.game.balance ?? 0);
  const setTab = useApp((s) => s.setTab);
  return (
    <button className="balance-chip" onClick={() => setTab('tap')} aria-label={`Баланс: ${formatCoins(balance)}`}>
      <Coin size={28} />
      {formatCoins(balance)}
    </button>
  );
}

export function Price({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <span className="row" style={{ gap: 5, display: 'inline-flex' }}>
      <Coin size={size} />
      <b style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCoins(value)}</b>
    </span>
  );
}

export function ProgressBar({ value, variant }: { value: number; variant?: 'lime' }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={`progress ${variant === 'lime' ? 'progress--lime' : ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Шапка вложенного экрана. В Telegram «назад» — нативная кнопка, в браузере рисуем свою. */
export function PageHead({ title, right }: { title?: ReactNode; right?: ReactNode }) {
  const pop = useApp((s) => s.pop);
  return (
    <div className="page-head">
      {!isTelegram && (
        <button className="icon-btn" onClick={pop} aria-label="Назад">
          <Icon name="back" size={22} />
        </button>
      )}
      <div className="h3" style={{ flex: 1 }}>
        {title}
      </div>
      {right}
    </div>
  );
}

interface ActionButton {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  shine?: boolean;
}

interface MainActionProps extends ActionButton {
  /** Экран с нижним меню: HTML-кнопка поднимается над ним. */
  aboveTabBar?: boolean;
  /** Цвет HTML-кнопки вне Telegram. */
  tone?: 'green' | 'violet';
  /** Вторая кнопка (SecondaryButton в Telegram), например «Купить за нутрики». */
  secondary?: ActionButton;
}

const HIDDEN: ActionButton = { text: '', onClick: () => undefined };

/** Главное действие экрана: нативные MainButton/SecondaryButton в Telegram, HTML-кнопки в браузере. */
export function MainAction({ aboveTabBar, tone = 'green', secondary, ...main }: MainActionProps) {
  const nativeMain = useMainButton({ ...main, color: tone === 'violet' ? '#8b7cf6' : undefined });
  const nativeSecondary = useSecondaryButton({ ...(secondary ?? HIDDEN), visible: Boolean(secondary) });
  const htmlSecondary = secondary && !nativeSecondary;
  if (nativeMain && !htmlSecondary) return null;
  return (
    <div className={`bottom-action ${aboveTabBar ? 'bottom-action--tabbar' : ''}`}>
      {htmlSecondary && (
        <button className="btn btn--violet-soft btn--block" onClick={secondary.onClick} disabled={secondary.disabled || secondary.loading}>
          {secondary.loading ? <span className="spinner" /> : secondary.text}
        </button>
      )}
      {!nativeMain && (
        <button
          className={`btn btn--block ${tone === 'violet' ? 'btn--violet' : 'btn--primary'}`}
          onClick={main.onClick}
          disabled={main.disabled || main.loading}
        >
          {main.loading ? <span className="spinner" /> : main.text}
        </button>
      )}
    </div>
  );
}

/** Рейтинг звёздами, как в карточках курсов референса. */
export function Stars({ rating, reviews }: { rating: number; reviews?: number }) {
  const full = Math.round(rating);
  return (
    <span className="stars" aria-label={`Рейтинг ${rating}`}>
      <b style={{ color: 'var(--ink)' }}>{rating.toFixed(1)}</b>
      <span className="stars__icons">{'★'.repeat(full)}{'☆'.repeat(5 - full)}</span>
      {reviews !== undefined && <span>({formatCoins(reviews)})</span>}
    </span>
  );
}

/** Двухцветный заголовок: текст + выделенное зелёным слово. */
export function AccentTitle({ text, accent, as: Tag = 'h2', className = 'h2' }: { text: string; accent: string; as?: 'h1' | 'h2'; className?: string }) {
  return (
    <Tag className={`${className} accent-title`}>
      {text} <em>{accent}</em>
    </Tag>
  );
}

export const formatRub = (value: number) => `${formatCoins(value)} ₽`;

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`} onClick={() => dismiss(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Empty({ emoji, title, text, action }: { emoji: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__emoji">{emoji}</div>
      <div className="h3">{title}</div>
      {text && <p className="muted small">{text}</p>}
      {action}
    </div>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <span aria-hidden="true">ℹ️</span>
      <span>{children}</span>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[NutriLab] UI error', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="state">
        <div style={{ fontSize: 48 }}>🥦</div>
        <h1 className="h2">Что-то пошло не так</h1>
        <p className="muted">Мы уже знаем о проблеме. Попробуйте перезапустить приложение.</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()}>
          Перезапустить
        </button>
      </div>
    );
  }
}
