import { GUIDE, QUIZ_REWARD, SCHOOL } from '@shared/catalog';
import { COURSES, EXPERT_PHOTO } from '@shared/courses';
import { MAX_SCORE, QUIZ_BANNER, QUIZ_RESULTS } from '@shared/quiz';
import { useApp } from '../store/appStore';
import { greeting } from '../lib/format';
import { links } from '../lib/config';
import { openLink } from '../telegram/webapp';
import { AccentTitle, Avatar, BalanceChip } from '../components/ui';
import { DailyBonus } from '../components/DailyBonus';
import { TaskList } from '../components/TaskList';
import { CourseCard } from '../components/CourseCard';
import { PageTip } from '../components/Onboarding';
import { Icon } from '../components/Icon';
import { Coin } from '../components/Coin';
import { Gauge, TIER_LABELS } from '../components/Gauge';

export function HomeScreen() {
  const user = useApp((s) => s.user)!;
  const setTab = useApp((s) => s.setTab);
  const push = useApp((s) => s.push);
  const { quiz } = user;

  return (
    <main className="screen stack">
      <header className="topbar" style={{ marginBottom: 0 }}>
        <Avatar profile={user.profile} />
        <div className="topbar__title">
          <div className="h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {greeting()}, {user.profile.firstName}
          </div>
          <div className="small muted">{SCHOOL.name} · {SCHOOL.tagline.toLowerCase()}</div>
        </div>
        <BalanceChip />
      </header>

      <PageTip id="home" />

      {quiz ? (
        <section className="hero home-result">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <span className="pill pill--glass">Ваш результат</span>
              <p className="h3" style={{ marginTop: 12 }}>
                {QUIZ_RESULTS[quiz.tier].title}
              </p>
              <p className="small muted" style={{ marginTop: 4 }}>
                {TIER_LABELS[quiz.tier]}
              </p>
            </div>
            <div className="home-result__gauge">
              <Gauge value={quiz.score} max={MAX_SCORE} tier={quiz.tier} size={130} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 16, gap: 10 }}>
            <button className="btn btn--white" style={{ flex: 1 }} onClick={() => push({ name: 'guide' })}>
              <Icon name="gift" size={18} /> Мой гид
            </button>
            <button className="btn btn--glass" style={{ flex: 1 }} onClick={() => push({ name: 'quiz-result' })}>
              Подробнее
            </button>
          </div>
        </section>
      ) : (
        <section className="hero">
          <span className="pill pill--glass">
            <Coin size={16} /> +{QUIZ_REWARD} и гид в подарок
          </span>
          <h1 className="h2" style={{ marginTop: 14, fontSize: 25 }}>
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

      <button className="card lead-card" onClick={() => (quiz ? push({ name: 'guide' }) : setTab('quiz'))} style={{ textAlign: 'left' }}>
        <div className="lead-card__art" aria-hidden="true">
          🥗
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="caps" style={{ color: 'var(--green)' }}>
            Подарок
          </div>
          <div className="h3">Гид «{GUIDE.title}»</div>
          <div className="small muted" style={{ marginTop: 2 }}>
            {quiz ? 'Персональные шаги, меню на 3 дня и чек-лист' : 'Откроется после прохождения теста'}
          </div>
        </div>
        <Icon name={quiz ? 'chevron' : 'lock'} size={20} />
      </button>

      <div className="section-head">
        <AccentTitle text="Новые" accent="курсы" />
        <button className="link" onClick={() => setTab('shop')}>
          Все
        </button>
      </div>
      <div className="hscroll">
        {COURSES.slice(0, 5).map((c) => (
          <CourseCard key={c.id} course={c} wide />
        ))}
      </div>

      <DailyBonus />

      <div className="section-head">
        <AccentTitle text="Задания за" accent="нутрики" />
      </div>
      <TaskList />

      <section className="card expert">
        <div className="row">
          <img className="expert-photo" src={EXPERT_PHOTO} alt={SCHOOL.expert.name} />
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
