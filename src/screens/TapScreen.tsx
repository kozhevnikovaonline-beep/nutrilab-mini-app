import { useCallback, useRef, useState, type PointerEvent } from 'react';
import { UPGRADES } from '@shared/catalog';
import { currentLevel, maxEnergy, regenEnergy, tapPower, upgradeCost } from '@shared/game';
import type { UpgradeId } from '@shared/types';
import { useApp } from '../store/appStore';
import { useNow } from '../lib/useNow';
import { formatCoins } from '../lib/format';
import { Coin } from '../components/Coin';
import { Icon } from '../components/Icon';
import { Price, ProgressBar } from '../components/ui';

interface Floater {
  id: number;
  x: number;
  y: number;
  value: number;
}

let floaterSeq = 0;

function Orb() {
  return (
    <svg viewBox="0 0 200 200" className="orb__svg" aria-hidden="true">
      <defs>
        <radialGradient id="orbFace" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#7fd66a" />
          <stop offset="0.55" stopColor="#2f8a3c" />
          <stop offset="1" stopColor="#0f3d1e" />
        </radialGradient>
        <linearGradient id="orbRim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0b0" />
          <stop offset="0.5" stopColor="#f4b63a" />
          <stop offset="1" stopColor="#b8770c" />
        </linearGradient>
        <linearGradient id="orbLeaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2ffd0" />
          <stop offset="1" stopColor="#c6ee78" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#orbRim)" />
      <circle cx="100" cy="100" r="86" fill="url(#orbFace)" />
      <circle cx="100" cy="100" r="74" fill="none" stroke="#d4f58a" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="2 6" />
      <path
        d="M138 58c-40 0-66 22-66 58 0 6 1 11 2.5 15.5C88 102 110 84 132 77c-22 11-38 30-46 56 5 2 11 3 17 3 33 0 50-28 50-64 0-5-.6-10-1.8-14H138z"
        fill="url(#orbLeaf)"
      />
      <ellipse cx="72" cy="56" rx="34" ry="16" fill="#fff" opacity="0.14" transform="rotate(-28 72 56)" />
    </svg>
  );
}

/** Тапалка: копим «нутрики», тратим энергию, прокачиваем бусты. */
export function TapScreen() {
  const user = useApp((s) => s.user)!;
  const tap = useApp((s) => s.tap);
  const run = useApp((s) => s.run);
  const busy = useApp((s) => s.busy);
  const now = useNow(1000);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const orbRef = useRef<HTMLButtonElement>(null);

  const game = regenEnergy(user.game, now);
  const max = maxEnergy(game);
  const power = tapPower(game);
  const level = currentLevel(game.totalEarned);
  const outOfEnergy = game.energy < power;

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const gained = tap();
      const el = orbRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Наклон монеты в сторону касания — как в Hamster Kombat.
      const rx = ((rect.height / 2 - y) / rect.height) * 18;
      const ry = ((x - rect.width / 2) / rect.width) * 18;
      el.animate(
        [
          { transform: `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) scale(0.95)` },
          { transform: 'perspective(600px) rotateX(0) rotateY(0) scale(1)' },
        ],
        { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
      if (gained <= 0) return;
      const id = ++floaterSeq;
      setFloaters((f) => [...f.slice(-14), { id, x, y, value: gained }]);
      setTimeout(() => setFloaters((f) => f.filter((fl) => fl.id !== id)), 900);
    },
    [tap],
  );

  const buy = (id: UpgradeId) => run({ type: 'upgrade/buy', upgradeId: id }, `upgrade:${id}`);

  return (
    <main className="screen tap-screen">
      <div className="tap-head">
        <span className="pill">
          <Icon name="sparkle" size={14} /> {level.level.title}
        </span>
        <div className="tap-balance">
          <Coin size={40} />
          <span>{formatCoins(game.balance)}</span>
        </div>
        <div className="tap-level">
          <ProgressBar value={level.progress} variant="lime" />
          <div className="small muted" style={{ marginTop: 6 }}>
            {level.next
              ? `До уровня «${level.next.title}» — ${formatCoins(level.next.minEarned - game.totalEarned)}`
              : 'Максимальный уровень'}
          </div>
        </div>
      </div>

      <div className="tap-stats">
        <div className="tap-stat">
          <span className="small muted">За тап</span>
          <b>+{power}</b>
        </div>
        <div className="tap-stat">
          <span className="small muted">Всего тапов</span>
          <b>{formatCoins(game.totalTaps)}</b>
        </div>
        <div className="tap-stat">
          <span className="small muted">Заработано</span>
          <b>{formatCoins(game.totalEarned)}</b>
        </div>
      </div>

      <div className="orb-wrap">
        <div className="orb-glow" aria-hidden="true" />
        <button
          ref={orbRef}
          className={`orb ${outOfEnergy ? 'is-empty' : ''}`}
          onPointerDown={onPointerDown}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={`Тапнуть: +${power}`}
        >
          <Orb />
        </button>
        {floaters.map((f) => (
          <span key={f.id} className="floater" style={{ left: f.x, top: f.y }}>
            +{f.value}
          </span>
        ))}
      </div>

      <div className="energy">
        <Icon name="bolt" size={20} />
        <b style={{ fontVariantNumeric: 'tabular-nums' }}>
          {game.energy} / {max}
        </b>
        <div style={{ flex: 1 }}>
          <ProgressBar value={game.energy / max} variant="lime" />
        </div>
      </div>
      {outOfEnergy && <p className="small muted" style={{ textAlign: 'center', marginTop: 8 }}>Энергия восстанавливается — 2 единицы в секунду</p>}

      <div className="section-head" style={{ marginTop: 22, marginBottom: 10 }}>
        <h2 className="h3">Бусты</h2>
      </div>
      <div className="boosts">
        {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
          const def = UPGRADES[id];
          const lvl = game.upgrades[id];
          const cost = upgradeCost(game, id);
          const key = `upgrade:${id}`;
          return (
            <div key={id} className="card boost">
              <div className="row" style={{ gap: 10 }}>
                <span className="list-item__icon">{def.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="list-item__title">{def.title}</div>
                  <div className="small muted">
                    Ур. {lvl} · {def.effectLabel(lvl)}
                  </div>
                </div>
              </div>
              <button
                className="btn btn--dark btn--sm btn--block"
                style={{ marginTop: 12 }}
                disabled={cost === null || cost > game.balance || busy[key]}
                onClick={() => buy(id)}
              >
                {busy[key] ? <span className="spinner" /> : cost === null ? 'Максимум' : <Price value={cost} size={16} />}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
