import type { ResultTier } from '@shared/types';

export const TIER_COLORS: Record<ResultTier, string> = {
  good: '#3f9142',
  attention: '#e6a224',
  priority: '#e0663a',
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

/** Полукруглый индикатор (как «дневная сводка» в референсе) с делениями. */
export function Gauge({ value, max, tier, caption = 'баллов', size = 220 }: GaugeProps) {
  const r = 80;
  const len = Math.PI * r;
  const ratio = Math.min(1, Math.max(0, value / max));
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const a = Math.PI - (i / 20) * Math.PI;
    const inner = i % 5 === 0 ? 92 : 95;
    return {
      x1: 100 + Math.cos(a) * inner,
      y1: 100 - Math.sin(a) * inner,
      x2: 100 + Math.cos(a) * 100,
      y2: 100 - Math.sin(a) * 100,
    };
  });

  return (
    <div style={{ position: 'relative', width: size, margin: '0 auto' }}>
      <svg viewBox="-4 -4 208 112" width={size} role="img" aria-label={`${value} из ${max} ${caption}`}>
        {ticks.map((t, i) => (
          <line key={i} {...t} stroke="currentColor" strokeOpacity={0.18} strokeWidth={i % 5 === 0 ? 2 : 1} strokeLinecap="round" />
        ))}
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={16} strokeLinecap="round" />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={TIER_COLORS[tier]}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${len * ratio} ${len}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center' }}>
        <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
        <div className="small muted">
          из {max} {caption}
        </div>
      </div>
    </div>
  );
}
