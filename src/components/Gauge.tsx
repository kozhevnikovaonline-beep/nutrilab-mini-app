import { useId } from 'react';
import type { ResultTier } from '@shared/types';

export const TIER_COLORS: Record<ResultTier, string> = {
  good: '#22a447',
  attention: '#f0a128',
  priority: '#e85d4a',
};

export const TIER_LABELS: Record<ResultTier, string> = {
  good: 'Хороший ресурс',
  attention: 'Нужно внимание',
  priority: 'Особое внимание',
};

interface GaugeProps {
  value: number;
  max: number;
  tier: ResultTier;
  /** Подпись под числом. */
  caption?: string;
  size?: number;
}

/**
 * Полукруглый индикатор с цветной шкалой (зелёный → жёлтый → красный),
 * как «Отчёты по питанию» в референсе. Чем выше балл теста, тем ближе к красному.
 */
export function Gauge({ value, max, tier, caption = 'баллов', size = 220 }: GaugeProps) {
  const id = useId();
  const r = 80;
  const len = Math.PI * r;
  const ratio = Math.min(1, Math.max(0, value / max));
  const angle = Math.PI - ratio * Math.PI;
  const knob = { x: 100 + Math.cos(angle) * r, y: 100 - Math.sin(angle) * r };

  return (
    <div style={{ position: 'relative', width: size, margin: '0 auto' }}>
      <svg viewBox="0 0 200 112" width={size} role="img" aria-label={`${value} из ${max} ${caption}`}>
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3cc463" />
            <stop offset="0.5" stopColor="#f5c33b" />
            <stop offset="1" stopColor="#ef5a4c" />
          </linearGradient>
        </defs>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={16} strokeLinecap="round" />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={`url(#${id}g)`}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${len * ratio} ${len}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(.2,.8,.2,1)' }}
        />
        <circle cx={knob.x} cy={knob.y} r={11} fill="#fff" stroke={TIER_COLORS[tier]} strokeWidth={5} />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 2, textAlign: 'center' }}>
        <div style={{ fontSize: 50, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em' }}>{value}</div>
        <div className="small muted">
          из {max} {caption}
        </div>
      </div>
    </div>
  );
}
