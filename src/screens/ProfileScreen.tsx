import { REFERRAL_REWARD, SCHOOL } from '@shared/catalog';
import { currentLevel } from '@shared/game';
import { MAX_SCORE, QUIZ_TITLE } from '@shared/quiz';
import { useApp } from '../store/appStore';
import { api } from '../api';
import { links } from '../lib/config';
import { formatCoins, formatDate } from '../lib/format';
import { confirmAction, openLink, shareLink, isTelegram } from '../telegram/webapp';
import { Avatar, ProgressBar } from '../components/ui';
import { Icon } from '../components/Icon';
import { Coin } from '../components/Coin';
import { TIER_COLORS, TIER_LABELS } from '../components/Gauge';

export function ProfileScreen() {
  const user = useApp((s) => s.user)!;
  const settings = useApp((s) => s.settings);
  const setHaptics = useApp((s) => s.setHaptics);
  const setTab = useApp((s) => s.setTab);
  const push = useApp((s) => s.push);
  const resetDemo = useApp((s) => s.resetDemo);
  const { game, quiz, profile } = user;
  const level = currentLevel(game.totalEarned);

  const invite = () =>
    shareLink(links.referral(profile.id), `Проходи тест «${QUIZ_TITLE}» в ${SCHOOL.name} и получи гид «Энергия на тарелке» в подарок 🌿`);

  const reset = async () => {
    if (await confirmAction('Сбросить весь демо-прогресс: монеты, покупки и результат теста?')) await resetDemo();
  };

  return (
    <main className="screen stack">
      <section className="hero profile-card">
        <div className="row" style={{ gap: 14 }}>
          <Avatar profile={profile} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h2" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile.firstName} {profile.lastName ?? ''}
            </div>
            <div className="muted small">{profile.username ? `@${profile.username}` : SCHOOL.tagline}</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 18 }}>
          <span className="pill pill--glass">
            <Icon name="sparkle" size={14} /> {level.level.title}
          </span>
          <span className="spacer" />
          <span className="row" style={{ gap: 6, fontWeight: 800, fontSize: 20 }}>
            <Coin size={24} /> {formatCoins(game.balance)}
          </span>
        </div>
        <div style={{ marginTop: 12 }}>
          <ProgressBar value={level.progress} variant="lime" />
        </div>
      </section>

      <div className="stats-grid">
        <div className="card stat">
          <span className="small muted">Заработано</span>
          <b>{formatCoins(game.totalEarned)}</b>
        </div>
        <div className="card stat">
          <span className="small muted">Тапов</span>
          <b>{formatCoins(game.totalTaps)}</b>
        </div>
        <div className="card stat">
          <span className="small muted">Покупок</span>
          <b>{user.purchases.length}</b>
        </div>
        <div className="card stat">
          <span className="small muted">Друзей</span>
          <b>{user.referrals}</b>
        </div>
      </div>

      <div className="list">
        <button className="list-item" onClick={() => (quiz ? push({ name: 'quiz-result' }) : setTab('quiz'))}>
          <span className="list-item__icon">📝</span>
          <div className="list-item__body">
            <div className="list-item__title">Тест «{QUIZ_TITLE}»</div>
            <div className="list-item__sub">
              {quiz ? `${quiz.score}/${MAX_SCORE} · ${formatDate(quiz.completedAt)}` : 'Ещё не пройден'}
            </div>
          </div>
          {quiz && <span className="tier-dot" style={{ background: TIER_COLORS[quiz.tier] }} aria-label={TIER_LABELS[quiz.tier]} />}
          <Icon name="chevron" size={18} />
        </button>
        <button className="list-item" onClick={() => push({ name: 'guide' })}>
          <span className="list-item__icon">🎁</span>
          <div className="list-item__body">
            <div className="list-item__title">Гид «Энергия на тарелке»</div>
            <div className="list-item__sub">{quiz ? 'Открыт' : 'Откроется после теста'}</div>
          </div>
          <Icon name={quiz ? 'chevron' : 'lock'} size={18} />
        </button>
        <button className="list-item" onClick={() => setTab('shop')}>
          <span className="list-item__icon">🛍️</span>
          <div className="list-item__body">
            <div className="list-item__title">Мои покупки</div>
            <div className="list-item__sub">{user.purchases.length ? `${user.purchases.length} шт.` : 'Пока пусто'}</div>
          </div>
          <Icon name="chevron" size={18} />
        </button>
      </div>

      <section className="card card--soft stack" style={{ gap: 10 }}>
        <div className="row">
          <span style={{ fontSize: 28 }}>🤝</span>
          <div style={{ flex: 1 }}>
            <div className="h3">Пригласите друзей</div>
            <div className="small text-2">+{formatCoins(REFERRAL_REWARD)} нутриков за каждого нового участника</div>
          </div>
        </div>
        <button className="btn btn--primary btn--block" onClick={invite}>
          <Icon name="share" size={18} /> Поделиться ссылкой
        </button>
      </section>

      <div className="list">
        <label className="list-item" style={{ cursor: 'pointer' }}>
          <span className="list-item__icon">📳</span>
          <div className="list-item__body">
            <div className="list-item__title">Вибро-отклик</div>
            <div className="list-item__sub">Тактильная отдача при тапах</div>
          </div>
          <input type="checkbox" className="switch" checked={settings.haptics} onChange={(e) => setHaptics(e.target.checked)} />
        </label>
        <button className="list-item" onClick={() => openLink(links.manager('Здравствуйте! У меня вопрос по NutriLab'))}>
          <span className="list-item__icon">💬</span>
          <div className="list-item__body">
            <div className="list-item__title">Поддержка</div>
            <div className="list-item__sub">Написать менеджеру школы</div>
          </div>
          <Icon name="chevron" size={18} />
        </button>
        <button className="list-item" onClick={() => openLink(links.channel())}>
          <span className="list-item__icon">📣</span>
          <div className="list-item__body">
            <div className="list-item__title">Канал {SCHOOL.name}</div>
            <div className="list-item__sub">Рецепты, разборы и эфиры</div>
          </div>
          <Icon name="chevron" size={18} />
        </button>
        {api.reset && (
          <button className="list-item" onClick={reset}>
            <span className="list-item__icon">🔄</span>
            <div className="list-item__body">
              <div className="list-item__title" style={{ color: 'var(--danger)' }}>
                Сбросить демо-прогресс
              </div>
              <div className="list-item__sub">Доступно только в демо-режиме</div>
            </div>
          </button>
        )}
      </div>

      <p className="small muted" style={{ textAlign: 'center' }}>
        {SCHOOL.name} · {SCHOOL.tagline}
        <br />
        {api.mode === 'mock' ? 'Демо-режим: данные хранятся на устройстве' : 'Данные синхронизированы с сервером'}
        {!isTelegram && ' · открыто вне Telegram'}
      </p>
    </main>
  );
}
