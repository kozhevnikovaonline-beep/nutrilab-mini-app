import { useEffect, useState } from 'react';
import { GUIDE, HABITS, HABIT_REWARD } from '@shared/catalog';
import { habitsForToday } from '@shared/game';
import { QUIZ_BLOCKS, focusBlocks } from '@shared/quiz';
import { useApp } from '../store/appStore';
import { useBackButton } from '../telegram/hooks';
import { haptic } from '../telegram/webapp';
import { api } from '../api';
import { useNow } from '../lib/useNow';
import { Disclaimer, Empty, PageHead, ProgressBar } from '../components/ui';
import { Icon } from '../components/Icon';
import { Coin } from '../components/Coin';

const MEAL_LABELS = ['Завтрак', 'Обед', 'Ужин'];
/** Блок «Привычки» — универсальный старт, если в ответах нет выраженных зон внимания. */
const DEFAULT_FOCUS = [4];

/** Лид-магнит: персональный гид «Энергия на тарелке». */
export function GuideScreen() {
  const user = useApp((s) => s.user)!;
  const run = useApp((s) => s.run);
  const busy = useApp((s) => s.busy);
  const pop = useApp((s) => s.pop);
  const push = useApp((s) => s.push);
  const setTab = useApp((s) => s.setTab);
  const toast = useApp((s) => s.toast);
  const [day, setDay] = useState(0);
  const [sending, setSending] = useState(false);
  const now = useNow(60_000);
  useBackButton(pop);

  const { quiz } = user;
  const guideClaimed = Boolean(user.tasks.guide);

  // Награда за открытие гида — один раз.
  const hasQuiz = Boolean(quiz);
  useEffect(() => {
    if (hasQuiz && !guideClaimed) void run({ type: 'task/claim', taskId: 'guide' }, 'task:guide');
  }, [hasQuiz, guideClaimed, run]);

  if (!quiz) {
    return (
      <main className="screen screen--stack">
        <PageHead title="Гид" />
        <Empty
          emoji="🔒"
          title={`Гид «${GUIDE.title}» пока закрыт`}
          text="Пройдите тест «Ваш ресурс» — гид соберётся по вашим ответам."
          action={
            <button className="btn btn--primary" style={{ marginTop: 8 }} onClick={() => setTab('quiz')}>
              Пройти тест
            </button>
          }
        />
      </main>
    );
  }

  const focus = focusBlocks(quiz.blockScores);
  const focusIndexes = focus.length ? focus : DEFAULT_FOCUS;
  const habits = habitsForToday(user, now);

  const sendToChat = async () => {
    setSending(true);
    try {
      const { sentToChat } = await api.sendLeadMagnet();
      if (sentToChat) {
        haptic.success();
        toast('Гид отправлен в чат с ботом', 'success');
      }
    } catch {
      toast('Не удалось отправить гид. Попробуйте позже', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="screen screen--stack stack">
      <PageHead title="Ваш гид" />

      <section className="hero guide-cover">
        <span className="pill pill--glass">
          <Icon name="gift" size={14} /> Подарок NutriLab
        </span>
        <h1 className="h1" style={{ marginTop: 14 }}>
          {GUIDE.title}
        </h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {GUIDE.subtitle}
        </p>
        <div className="guide-cover__plate" aria-hidden="true">
          🥗
        </div>
        {api.mode === 'remote' && (
          <button className="btn btn--white btn--sm" style={{ marginTop: 16 }} disabled={sending} onClick={sendToChat}>
            {sending ? <span className="spinner" /> : <><Icon name="chat" size={16} /> Отправить в чат</>}
          </button>
        )}
      </section>

      <p className="text-2">{GUIDE.intro}</p>

      <div className="section-head">
        <h2 className="h3">1. Ваш фокус на эту неделю</h2>
      </div>
      {focusIndexes.map((i) => (
        <section key={i} className="card stack" style={{ gap: 10 }}>
          <div className="row">
            <span className="list-item__icon" style={{ background: 'var(--lime-soft)' }}>
              {QUIZ_BLOCKS[i].emoji}
            </span>
            <div style={{ flex: 1 }}>
              <div className="h3">{QUIZ_BLOCKS[i].title}</div>
              {focus.length > 0 && <div className="small muted">{quiz.blockScores[i]} из 10 баллов</div>}
            </div>
          </div>
          <ul className="bullets">
            {GUIDE.focusTips[i].map((tip) => (
              <li key={tip} className="small">
                {tip}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="section-head">
        <h2 className="h3">2. Правило тарелки</h2>
      </div>
      <section className="card plate">
        <div className="plate__chart" aria-hidden="true" />
        <div className="stack" style={{ gap: 10, flex: 1 }}>
          {GUIDE.plate.map((p) => (
            <div key={p.label} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span className="plate__swatch" style={{ background: p.color }}>
                {p.share}
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.label}</div>
                <div className="small muted">{p.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-head">
        <h2 className="h3">3. Меню на 3 дня</h2>
      </div>
      <div className="segments" role="tablist">
        {GUIDE.menu.map((m, i) => (
          <button key={m.day} role="tab" aria-selected={day === i} className="segments__item" onClick={() => setDay(i)}>
            {m.day}
          </button>
        ))}
      </div>
      <div className="list">
        {GUIDE.menu[day].meals.map((meal, i) => (
          <div key={meal} className="list-item">
            <span className="list-item__icon">{['🌅', '☀️', '🌙'][i]}</span>
            <div className="list-item__body">
              <div className="list-item__sub">{MEAL_LABELS[i]}</div>
              <div className="list-item__title">{meal}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2 className="h3">4. Чек-лист на сегодня</h2>
        <span className="small muted">
          {habits.done.length}/{HABITS.length}
        </span>
      </div>
      <ProgressBar value={habits.done.length / HABITS.length} />
      <div className="list">
        {HABITS.map((h) => {
          const done = habits.done.includes(h.id);
          const rewarded = habits.rewarded.includes(h.id);
          const key = `habit:${h.id}`;
          return (
            <button
              key={h.id}
              className="list-item"
              disabled={busy[key]}
              onClick={() => run({ type: 'habit/toggle', habitId: h.id }, key)}
              aria-pressed={done}
            >
              <span className="list-item__icon">{h.emoji}</span>
              <div className="list-item__body">
                <div className="list-item__title" style={{ textDecoration: done ? 'line-through' : undefined, opacity: done ? 0.6 : 1 }}>
                  {h.title}
                </div>
                {!rewarded && (
                  <div className="list-item__sub row" style={{ gap: 4 }}>
                    <Coin size={13} /> +{HABIT_REWARD}
                  </div>
                )}
              </div>
              <span className={`check ${done ? 'check--on' : ''}`}>
                <Icon name="check" size={16} strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>
      <p className="small muted" style={{ textAlign: 'center' }}>
        Отмечайте привычки каждый день — за каждую начисляются нутрики.
      </p>

      <section className="hero stack" style={{ gap: 12 }}>
        <p className="h3">Хотите персональный план?</p>
        <p style={{ opacity: 0.9 }} className="small">
          Гид — это первый шаг. На консультации мы разберём ваш рацион и режим и составим план под ваши цели.
        </p>
        <button className="btn btn--lime btn--block" onClick={() => push({ name: 'product', productId: 'consultation' })}>
          Узнать о консультации
        </button>
      </section>

      <Disclaimer>Гид носит информационный характер и не заменяет консультацию врача.</Disclaimer>
    </main>
  );
}
