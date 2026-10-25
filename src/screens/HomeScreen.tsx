import { GUIDE, PRODUCTS, QUIZ_REWARD, SCHOOL } from '@shared/catalog';
import { MAX_SCORE, QUIZ_BANNER, QUIZ_RESULTS } from '@shared/quiz';
import { useApp } from '../store/appStore';
import { greeting } from '../lib/format';
import { links } from '../lib/config';
import { openLink } from '../telegram/webapp';
import { Avatar, BalanceChip } from '../components/ui';
import { DailyBonus } from '../components/DailyBonus';
import { TaskList } from '../components/TaskList';
import { ProductCard } from '../components/ProductCard';
import { Icon } from '../components/Icon';
import { Coin } from '../components/Coin';
import { TIER_COLORS, TIER_LABELS } from '../components/Gauge';

export function HomeScreen() {
  const user = useApp((s) => s.user)!;
  const setTab = useApp((s) => s.setTab);
  const push = useApp((s) => s.push);
  const { quiz } = user;

  return (
    <main className="screen stack">
      <header className="topbar" style={{ marginBottom: 2 }}>
        <Avatar profile={user.profile} />
        <div className="topbar__title">
          <div className="small muted">{greeting()},</div>
          <div className="h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.profile.firstName}
          </div>
        </div>
        <BalanceChip />
      </header>

      {quiz ? (
        <section className="hero">
          <div className="row" style={{ marginBottom: 14 }}>
            <span className="pill pill--glass">Ваш ресурс</span>
            <span className="spacer" />
            <span className="pill" style={{ background: TIER_COLORS[quiz.tier], color: '#fff' }}>
              {TIER_LABELS[quiz.tier]}
            </span>
          </div>
          <div className="row" style={{ alignItems: 'flex-end', gap: 8 }}>
            <span style={{ fontSize: 56, fontWeight: 800, lineHeight: 0.9, letterSpacing: '-0.04em' }}>{quiz.score}</span>
            <span className="muted" style={{ paddingBottom: 4 }}>/ {MAX_SCORE} баллов</span>
          </div>
          <p className="h3" style={{ marginTop: 10 }}>
            {QUIZ_RESULTS[quiz.tier].title}
          </p>
          <div className="row" style={{ marginTop: 18, gap: 10 }}>
            <button className="btn btn--lime" style={{ flex: 1 }} onClick={() => push({ name: 'guide' })}>
              <Icon name="gift" size={18} /> Мой гид
            </button>
            <button className="btn btn--white" style={{ flex: 1 }} onClick={() => push({ name: 'quiz-result' })}>
              Результат
            </button>
          </div>
        </section>
      ) : (
        <section className="hero">
          <span className="pill pill--glass">
            <Coin size={16} /> +{QUIZ_REWARD} и гид в подарок
          </span>
          <h1 className="h2" style={{ marginTop: 14, fontSize: 24 }}>
            {QUIZ_BANNER.title}
          </h1>
          <p className="muted small" style={{ marginTop: 10 }}>
            {QUIZ_BANNER.text}
          </p>
          <button className="btn btn--white" style={{ marginTop: 18 }} onClick={() => setTab('quiz')}>
            {QUIZ_BANNER.button}
            <Icon name="chevron" size={18} />
          </button>
        </section>
      )}

      <button
        className="card card--lime lead-card"
        onClick={() => (quiz ? push({ name: 'guide' }) : setTab('quiz'))}
        style={{ textAlign: 'left' }}
      >
        <div className="lead-card__art" aria-hidden="true">
          🥗
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="caps" style={{ opacity: 0.7 }}>
            Подарок
          </div>
          <div className="h3">Гид «{GUIDE.title}»</div>
          <div className="small" style={{ opacity: 0.75, marginTop: 2 }}>
            {quiz ? 'Персональные шаги, меню на 3 дня и чек-лист привычек' : 'Откроется после прохождения теста'}
          </div>
        </div>
        <Icon name={quiz ? 'chevron' : 'lock'} size={20} />
      </button>

      <DailyBonus />

      <div className="section-head">
        <h2 className="h3">Задания</h2>
      </div>
      <TaskList />

      <div className="section-head">
        <h2 className="h3">Магазин школы</h2>
        <button className="link" onClick={() => setTab('shop')}>
          Все
        </button>
      </div>
      <div className="hscroll">
        {PRODUCTS.slice(0, 5).map((p) => (
          <ProductCard key={p.id} product={p} wide />
        ))}
      </div>

      <section className="card expert">
        <div className="row">
          <div className="expert__photo" aria-hidden="true">
            👩‍⚕️
          </div>
          <div style={{ flex: 1 }}>
            <div className="h3">{SCHOOL.expert.name}</div>
            <div className="small muted">{SCHOOL.expert.role}</div>
          </div>
        </div>
        <p className="small text-2" style={{ marginTop: 12 }}>
          {SCHOOL.expert.bio}
        </p>
        <div className="expert__stats">
          {SCHOOL.stats.map((s) => (
            <div key={s.label}>
              <div className="h3">{s.value}</div>
              <div className="small muted">{s.label}</div>
            </div>
          ))}
        </div>
        <button className="btn btn--ghost btn--block" style={{ marginTop: 14 }} onClick={() => openLink(links.manager('Здравствуйте! Хочу узнать о консультации'))}>
          <Icon name="chat" size={18} /> Задать вопрос
        </button>
      </section>
    </main>
  );
}
