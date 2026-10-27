import { useEffect, useRef } from 'react';
import { GUIDE, QUIZ_REWARD } from '@shared/catalog';
import {
  AFTER_RESULT,
  ANSWER_OPTIONS,
  BLOCK_MAX_SCORE,
  MAX_SCORE,
  QUESTIONS,
  QUESTION_COUNT,
  QUIZ_BLOCKS,
  QUIZ_RESULTS,
  QUIZ_DURATION,
  QUIZ_TITLE,
  QUIZ_WELCOME,
} from '@shared/quiz';
import { useApp } from '../store/appStore';
import { useBackButton } from '../telegram/hooks';
import { confirmAction, openLink, requestWriteAccess } from '../telegram/webapp';
import { links } from '../lib/config';
import { formatDate } from '../lib/format';
import { api } from '../api';
import { Disclaimer, MainAction, PageHead, ProgressBar } from '../components/ui';
import { Gauge, TIER_COLORS, TIER_LABELS } from '../components/Gauge';
import { Icon } from '../components/Icon';
import { Coin } from '../components/Coin';

const answeredCount = (answers: unknown[]) => answers.filter((a) => a !== null).length;

/** Вкладка «Тест»: приветствие или сводка по пройденному тесту. */
export function QuizTab() {
  const user = useApp((s) => s.user)!;
  const draft = useApp((s) => s.quizDraft);
  const push = useApp((s) => s.push);
  const resetQuizDraft = useApp((s) => s.resetQuizDraft);
  const progress = answeredCount(draft.answers);
  const { quiz } = user;

  const start = () => push({ name: 'quiz-run' });

  const retake = async () => {
    if (await confirmAction('Пройти тест заново? Предыдущий результат будет заменён новым.')) {
      resetQuizDraft();
      start();
    }
  };

  if (quiz) {
    return (
      <main className="screen stack">
        <h1 className="h1">Тест</h1>
        <section className="card" style={{ textAlign: 'center' }}>
          <div className="caps muted">«{QUIZ_TITLE}»</div>
          <div style={{ margin: '16px 0 8px' }}>
            <Gauge value={quiz.score} max={MAX_SCORE} tier={quiz.tier} />
          </div>
          <span className="pill" style={{ background: TIER_COLORS[quiz.tier], color: '#fff' }}>
            {TIER_LABELS[quiz.tier]}
          </span>
          <p className="h3" style={{ marginTop: 12 }}>
            {QUIZ_RESULTS[quiz.tier].title}
          </p>
          <p className="small muted" style={{ marginTop: 4 }}>
            Пройден {formatDate(quiz.completedAt)}
          </p>
          <div className="stack" style={{ gap: 10, marginTop: 18 }}>
            <button className="btn btn--primary btn--block" onClick={() => push({ name: 'quiz-result' })}>
              Подробный результат
            </button>
            <button className="btn btn--ghost btn--block" onClick={() => push({ name: 'guide' })}>
              <Icon name="gift" size={18} /> Гид «{GUIDE.title}»
            </button>
          </div>
        </section>
        <button className="btn btn--ghost btn--block" onClick={retake}>
          <Icon name="refresh" size={18} /> Пройти заново
        </button>
      </main>
    );
  }

  return (
    <main className="screen stack">
      <section className="hero">
        <span className="pill pill--glass">
          <Coin size={16} /> +{QUIZ_REWARD} нутриков за прохождение
        </span>
        <h1 className="h1" style={{ marginTop: 16 }}>
          {QUIZ_TITLE}
        </h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {QUIZ_DURATION}
        </p>
        <div className="row" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
          <span className="pill pill--glass">25 вопросов</span>
          <span className="pill pill--glass">5 сфер</span>
        </div>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <p className="h3">{QUIZ_WELCOME.greeting}</p>
        {QUIZ_WELCOME.paragraphs.map((p) => (
          <p key={p} className="text-2">
            {p}
          </p>
        ))}
        <p className="text-2">
          <b>{QUIZ_WELCOME.duration}</b>
        </p>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <p className="h3">Как отвечать</p>
        <p className="small text-2">{QUIZ_WELCOME.instruction}</p>
        <div className="scale">
          {ANSWER_OPTIONS.map((o) => (
            <div key={o.value} className="scale__item">
              <span className="scale__points">{o.value}</span>
              <span className="small">{o.label}</span>
            </div>
          ))}
        </div>
        <p className="small text-2">{QUIZ_WELCOME.outro}</p>
      </section>

      <div className="block-chips">
        {QUIZ_BLOCKS.map((b) => (
          <span key={b.id} className="pill">
            {b.emoji} {b.shortTitle}
          </span>
        ))}
      </div>

      <Disclaimer>
        <b>Важно:</b> {QUIZ_WELCOME.disclaimer}
      </Disclaimer>

      <MainAction
        text={progress > 0 ? `Продолжить тест · ${progress}/${QUESTION_COUNT}` : QUIZ_WELCOME.button}
        onClick={start}
        shine
        aboveTabBar
      />
    </main>
  );
}

/** Прохождение теста: по одному вопросу, автопереход после ответа. */
export function QuizRunScreen() {
  const draft = useApp((s) => s.quizDraft);
  const answer = useApp((s) => s.answerQuestion);
  const goTo = useApp((s) => s.goToQuestion);
  const pop = useApp((s) => s.pop);
  const run = useApp((s) => s.run);
  const busy = useApp((s) => s.busy['quiz/submit']);
  const hadQuiz = useApp((s) => Boolean(s.user?.quiz));
  const resetQuizDraft = useApp((s) => s.resetQuizDraft);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>();

  const question = QUESTIONS[draft.index];
  const block = QUIZ_BLOCKS[question.blockIndex];
  const selected = draft.answers[draft.index];
  const done = answeredCount(draft.answers);
  const complete = done === QUESTION_COUNT;
  const isFirstInBlock = QUESTIONS.findIndex((q) => q.blockIndex === question.blockIndex) === draft.index;

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const back = () => {
    clearTimeout(advanceTimer.current);
    if (draft.index > 0) goTo(draft.index - 1);
    else pop();
  };
  useBackButton(back);

  const submit = async () => {
    const answers = draft.answers;
    if (answers.some((a) => a === null)) return;
    const result = await run({ type: 'quiz/submit', answers: answers as NonNullable<(typeof answers)[number]>[] });
    if (!result) return;
    resetQuizDraft();
    // Выдача лид-магнита: на сервере бот пришлёт гид в чат; в демо гид открыт в приложении.
    if (api.mode === 'remote') {
      void requestWriteAccess()
        .then(() => api.sendLeadMagnet())
        .then(({ sentToChat }) => sentToChat && useApp.getState().toast('Гид также отправлен в чат с ботом', 'info'))
        .catch(() => undefined);
    }
    useApp.setState({ stack: [{ name: 'quiz-result' }] });
    if (!hadQuiz) useApp.getState().toast('🎁 Гид «Энергия на тарелке» открыт!', 'success');
  };

  return (
    <main className="screen screen--stack quiz">
      <PageHead
        title={
          <span className="row" style={{ gap: 8 }}>
            <span className="muted small" style={{ fontWeight: 700 }}>
              Вопрос {draft.index + 1} из {QUESTION_COUNT}
            </span>
          </span>
        }
      />
      <ProgressBar value={done / QUESTION_COUNT} />

      <div key={draft.index} className="quiz__body">
        <span className="pill pill--lime">
          {block.emoji} Блок {question.blockIndex + 1}. {block.shortTitle}
        </span>
        {isFirstInBlock && <p className="small muted" style={{ marginTop: 10 }}>{block.intro}</p>}
        <h1 className="h2 quiz__question">{question.text}</h1>

        <div className="stack" style={{ gap: 10 }} role="radiogroup" aria-label="Варианты ответа">
          {ANSWER_OPTIONS.map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={selected === o.value}
              className={`answer ${selected === o.value ? 'is-selected' : ''}`}
              onClick={() => {
                clearTimeout(advanceTimer.current);
                answer(o.value);
                const next = draft.index + 1;
                // Короткая пауза, чтобы пользователь увидел свой выбор.
                if (next < QUESTION_COUNT) advanceTimer.current = setTimeout(() => goTo(next), 220);
              }}
            >
              <span className="answer__dot">{selected === o.value && <Icon name="check" size={14} strokeWidth={3} />}</span>
              <span style={{ flex: 1 }}>{o.label}</span>
              <span className="answer__points">{o.value}</span>
            </button>
          ))}
        </div>

        <div className="row quiz__nav">
          <button className="btn btn--ghost btn--sm" disabled={draft.index === 0} onClick={back}>
            <Icon name="back" size={16} /> Назад
          </button>
          <span className="spacer" />
          {selected !== null && draft.index < QUESTION_COUNT - 1 && (
            <button className="btn btn--ghost btn--sm" onClick={() => goTo(draft.index + 1)}>
              Далее <Icon name="chevron" size={16} />
            </button>
          )}
        </div>
      </div>

      {complete && <MainAction text="Узнать результат" onClick={submit} loading={busy} shine />}
    </main>
  );
}

/** Подробный результат теста + выдача лид-магнита и приглашение на консультацию. */
export function QuizResultScreen() {
  const quiz = useApp((s) => s.user?.quiz);
  const pop = useApp((s) => s.pop);
  const push = useApp((s) => s.push);
  useBackButton(pop);

  if (!quiz) return null;
  const content = QUIZ_RESULTS[quiz.tier];

  return (
    <main className="screen screen--stack stack">
      <PageHead title="Ваш результат" />

      <section className="card" style={{ textAlign: 'center' }}>
        <Gauge value={quiz.score} max={MAX_SCORE} tier={quiz.tier} />
        <span className="pill" style={{ marginTop: 12, background: TIER_COLORS[quiz.tier], color: '#fff' }}>
          {TIER_LABELS[quiz.tier]} · {content.range[0]}–{content.range[1]}
        </span>
        <h1 className="h2" style={{ marginTop: 12 }}>
          {content.title}
        </h1>
      </section>

      <section className="card stack" style={{ gap: 14 }}>
        <p className="h3">Сферы самочувствия</p>
        {QUIZ_BLOCKS.map((b, i) => {
          const score = quiz.blockScores[i];
          const ratio = score / BLOCK_MAX_SCORE;
          return (
            <div key={b.id}>
              <div className="row small" style={{ marginBottom: 6 }}>
                <span>{b.emoji}</span>
                <b style={{ flex: 1 }}>{b.shortTitle}</b>
                <span className="muted">
                  {score}/{BLOCK_MAX_SCORE}
                </span>
              </div>
              <div className="progress">
                <div
                  className="progress__bar"
                  style={{ width: `${Math.max(4, ratio * 100)}%`, background: ratio > 0.6 ? TIER_COLORS.priority : ratio > 0.3 ? TIER_COLORS.attention : TIER_COLORS.good }}
                />
              </div>
            </div>
          );
        })}
        <p className="small muted">Чем выше показатель, тем больше внимания стоит уделить этой сфере.</p>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        {content.paragraphs.map((p) => (
          <p key={p} className="text-2">
            {p}
          </p>
        ))}
        <p className="h3" style={{ marginTop: 4 }}>
          {content.actionsTitle}:
        </p>
        <ul className="bullets">
          {content.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="small muted">{content.note}</p>
      </section>

      <button className="card card--lime lead-card" style={{ textAlign: 'left' }} onClick={() => push({ name: 'guide' })}>
        <div className="lead-card__art" aria-hidden="true">
          🎁
        </div>
        <div style={{ flex: 1 }}>
          <div className="caps" style={{ opacity: 0.7 }}>
            Ваш подарок открыт
          </div>
          <div className="h3">Гид «{GUIDE.title}»</div>
          <div className="small" style={{ opacity: 0.75 }}>
            Составлен по вашим ответам
          </div>
        </div>
        <Icon name="chevron" size={20} />
      </button>

      <section className="hero stack" style={{ gap: 12 }}>
        {content.invite.map((p) => (
          <p key={p} style={{ opacity: 0.92 }}>
            {p}
          </p>
        ))}
        <button className="btn btn--lime btn--block" onClick={() => openLink(links.manager(`Здравствуйте! Я прошёл(-ла) тест «${QUIZ_TITLE}», мой результат — ${quiz.score} баллов. ${content.cta}.`))}>
          {content.cta}
        </button>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <p className="h3">{AFTER_RESULT.title}</p>
        {AFTER_RESULT.paragraphs.map((p) => (
          <p key={p} className="text-2">
            {p}
          </p>
        ))}
        <p className="h3" style={{ fontSize: 15 }}>
          {AFTER_RESULT.listTitle}:
        </p>
        <ul className="bullets">
          {AFTER_RESULT.list.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <button className="btn btn--ghost btn--block" onClick={() => push({ name: 'product', productId: 'consultation' })}>
          {AFTER_RESULT.cta}
        </button>
      </section>

      <Disclaimer>{QUIZ_WELCOME.disclaimer}</Disclaimer>

      <MainAction text={`Открыть гид «${GUIDE.title}»`} onClick={() => push({ name: 'guide' })} />
    </main>
  );
}
