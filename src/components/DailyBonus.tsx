import { DAILY_REWARDS } from '@shared/catalog';
import { dailyStatus } from '@shared/game';
import { useApp } from '../store/appStore';
import { useNow } from '../lib/useNow';
import { formatCompact } from '../lib/format';
import { Coin } from './Coin';
import { Icon } from './Icon';

/** Ежедневный бонус с 7-дневной серией (визуально — как календарная лента из референса). */
export function DailyBonus() {
  const user = useApp((s) => s.user)!;
  const run = useApp((s) => s.run);
  const busy = useApp((s) => s.busy['daily/claim']);
  const now = useNow(30_000);
  const status = dailyStatus(user, now);
  const position = (status.nextStreak - 1) % DAILY_REWARDS.length;

  return (
    <section className="card">
      <div className="row" style={{ marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div className="h3">Ежедневный бонус</div>
          <div className="small muted">
            {status.claimedToday ? 'Возвращайтесь завтра — серия продолжится' : 'Заходите каждый день — награда растёт'}
          </div>
        </div>
        <span className="pill pill--lime">
          <Icon name="flame" size={14} /> {status.nextStreak} д.
        </span>
      </div>

      <div className="daily">
        {DAILY_REWARDS.map((reward, i) => {
          const claimed = i < position || (i === position && status.claimedToday);
          const today = i === position && !status.claimedToday;
          return (
            <div key={i} className={`daily__day ${claimed ? 'is-claimed' : ''} ${today ? 'is-today' : ''}`}>
              <span className="daily__label">{i + 1}</span>
              {claimed ? <Icon name="check" size={16} strokeWidth={3} /> : <Coin size={16} />}
              <span className="daily__reward">{formatCompact(reward)}</span>
            </div>
          );
        })}
      </div>

      <button
        className="btn btn--dark btn--block"
        style={{ marginTop: 14 }}
        disabled={status.claimedToday || busy}
        onClick={() => run({ type: 'daily/claim' })}
      >
        {busy ? <span className="spinner" /> : status.claimedToday ? 'Бонус получен' : `Забрать +${status.reward}`}
      </button>
    </section>
  );
}
