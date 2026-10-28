import { useState, type ReactNode } from 'react';
import { QUIZ_REWARD, SCHOOL } from '@shared/catalog';
import { EXPERT_PHOTO, courseLessonCount, findCourse } from '@shared/courses';
import { useApp } from '../store/appStore';
import { haptic } from '../telegram/webapp';
import { Coin } from './Coin';
import { Icon } from './Icon';
import { formatCoins } from '../lib/format';
import { coinDiscount } from '@shared/pricing';

// ───────────────────────── Приветственные слайды ─────────────────────────

interface Slide {
  title: string;
  accent: string;
  /** Текст после акцентного слова. */
  after?: string;
  /** Акцентное слово идёт перед основным текстом. */
  accentFirst?: boolean;
  text: string;
  art: ReactNode;
}

function GaugeArt() {
  return (
    <div className="ob-art">
      <div className="ob-float ob-card ob-score">
        <svg viewBox="0 0 200 112" width="170" aria-hidden="true">
          <defs>
            <linearGradient id="obg" x1="0" x2="1">
              <stop offset="0" stopColor="#3cc463" />
              <stop offset="0.5" stopColor="#f5c33b" />
              <stop offset="1" stopColor="#ef5a4c" />
            </linearGradient>
          </defs>
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#eef2ec" strokeWidth="16" strokeLinecap="round" />
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#obg)" strokeWidth="16" strokeLinecap="round" strokeDasharray="176 252" />
        </svg>
        <div className="ob-score__num">
          35<span>/50</span>
        </div>
      </div>
      <div className="ob-float ob-bubble ob-bubble--alert" style={{ left: 6, bottom: 36 }}>
        ❗ Особое внимание
      </div>
      <div className="ob-float ob-bubble ob-bubble--white" style={{ right: 4, top: 26 }}>
        25 вопросов · 1–3 мин
      </div>
    </div>
  );
}

function PlanArt() {
  const rows = [
    ['💧', '6–8 стаканов воды', 'var(--sky)'],
    ['🥦', 'Овощи в 2 приёмах пищи', 'var(--mint)'],
    ['🚶', 'Прогулка 20+ минут', 'var(--peach)'],
    ['🌙', 'Сон до 23:30', 'var(--lavender)'],
  ];
  return (
    <div className="ob-art">
      <div className="ob-clipboard ob-float">
        <div className="ob-clipboard__clip" />
        <b>Энергия на тарелке</b>
        <span className="small muted">Ваш персональный гид</span>
      </div>
      <div className="ob-plan">
        {rows.map(([emoji, text, bg], i) => (
          <div key={text} className="ob-plan__row" style={{ background: bg, animationDelay: `${0.1 + i * 0.08}s` }}>
            {emoji} {text}
          </div>
        ))}
      </div>
    </div>
  );
}

function TapArt() {
  return (
    <div className="ob-art">
      <div className="ob-coin ob-float">
        <Coin size={150} />
      </div>
      <span className="ob-plus" style={{ left: '22%', top: '18%' }}>
        +1
      </span>
      <span className="ob-plus" style={{ right: '20%', top: '30%', animationDelay: '0.4s' }}>
        +2
      </span>
      <div className="ob-float ob-bubble ob-bubble--white" style={{ left: 4, bottom: 30 }}>
        🎁 +{QUIZ_REWARD} за тест
      </div>
      <div className="ob-float ob-bubble" style={{ right: 4, bottom: 70 }}>
        🔥 Бонус каждый день
      </div>
    </div>
  );
}

function CoursesArt() {
  const course = findCourse('course-mini')!;
  const lessons = courseLessonCount(course);
  return (
    <div className="ob-art">
      <div className="ob-course ob-float">
        <div className="ob-course__img" />
        <b>{course.title}</b>
        <div className="chips" style={{ gap: 6 }}>
          <span className="chip" style={{ height: 26, fontSize: 11 }}>{formatCoins(course.students)} учеников</span>
          <span className="chip" style={{ height: 26, fontSize: 11 }}>{lessons} уроков</span>
        </div>
        <div className="ob-course__btn">Купить за {formatCoins(course.priceRub)} ₽</div>
        <div className="ob-course__btn ob-course__btn--soft">
          <Coin size={14} /> −30% нутриками: {formatCoins(coinDiscount(course.priceRub, Infinity).finalRub)} ₽
        </div>
      </div>
      <img className="ob-avatar ob-float" src={EXPERT_PHOTO} alt="" />
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    title: 'Узнайте, что',
    after: 'чувствовать себя лучше?',
    accent: 'мешает вам',
    text: 'Пройдите короткий тест о самочувствии: энергия, пищеварение, сон, внешность и привычки. Результат — сразу.',
    art: <GaugeArt />,
  },
  {
    title: 'план в подарок',
    accent: 'Персональный',
    accentFirst: true,
    text: 'После теста откроется гид «Энергия на тарелке»: ваши зоны фокуса, меню на 3 дня и чек-лист привычек.',
    art: <PlanArt />,
  },
  {
    title: 'Тапайте и',
    accent: 'копите нутрики',
    text: 'Нажимайте на монету в центре меню, забирайте ежедневный бонус и выполняйте задания — нутрики копятся на балансе.',
    art: <TapArt />,
  },
  {
    title: 'Курсы со скидкой',
    accent: 'до 30% нутриками',
    text: `Курсы и консультации ${SCHOOL.name} оплачиваются картой, а накопленными нутриками можно оплатить до 30% цены. Кураторы помогут на каждом шаге.`,
    art: <CoursesArt />,
  },
];

/** Приветственный онбординг при первом запуске (и по кнопке «Как пользоваться» в профиле). */
export function OnboardingFlow() {
  const complete = useApp((s) => s.completeOnboarding);
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const next = () => {
    haptic.select();
    if (last) complete();
    else setIndex(index + 1);
  };

  return (
    <div className="onboarding" role="dialog" aria-label="Как пользоваться приложением">
      <div className="onboarding__top">
        <div className="onboarding__dots" aria-hidden="true">
          {SLIDES.map((_, i) => (
            <span key={i} className={i === index ? 'is-active' : ''} />
          ))}
        </div>
        {!last && (
          <button className="onboarding__skip" onClick={complete}>
            Пропустить
          </button>
        )}
      </div>

      <div key={index} className="onboarding__slide">
        <h1 className="onboarding__title accent-title">
          {slide.accentFirst ? (
            <>
              <em>{slide.accent}</em> {slide.title}
            </>
          ) : (
            <>
              {slide.title} <em>{slide.accent}</em>{slide.after ? ` ${slide.after}` : null}
            </>
          )}
        </h1>
        <div className="onboarding__stage">{slide.art}</div>
        <p className="onboarding__text">{slide.text}</p>
      </div>

      <div className="onboarding__actions">
        {index > 0 && (
          <button className="btn btn--ghost" onClick={() => setIndex(index - 1)} aria-label="Назад">
            <Icon name="back" size={20} />
          </button>
        )}
        <button className="btn btn--primary" style={{ flex: 1 }} onClick={next}>
          {last ? 'Начать' : 'Далее'}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── Подсказки на страницах ─────────────────────────

export type TipId = 'home' | 'quiz' | 'tap' | 'shop' | 'course' | 'profile' | 'guide';

const TIPS: Record<TipId, { emoji: string; title: string; steps: string[] }> = {
  home: {
    emoji: '🏠',
    title: 'Главная',
    steps: [
      'Начните с теста в зелёном блоке — он займёт 1–3 минуты.',
      'Забирайте ежедневный бонус: чем дольше серия, тем больше нутриков.',
      'Выполняйте задания и следите за новыми курсами ниже.',
    ],
  },
  quiz: {
    emoji: '📝',
    title: 'Тест',
    steps: [
      'Отвечайте, как вы чувствовали себя последние 2–4 недели.',
      'Прогресс сохраняется — можно прерваться и продолжить позже.',
      `После теста получите результат, гид в подарок и +${QUIZ_REWARD} нутриков.`,
    ],
  },
  tap: {
    emoji: '🪙',
    title: 'Фарм нутриков',
    steps: [
      'Нажимайте на монету — каждый тап приносит нутрики.',
      'Тап тратит энергию, она восстанавливается сама: 2 единицы в секунду.',
      'Покупайте бусты, чтобы получать больше за тап и дольше играть.',
    ],
  },
  shop: {
    emoji: '🎓',
    title: 'Курсы и магазин',
    steps: [
      'Во вкладке «Курсы» — курсы, программы и персональные консультации.',
      'Все курсы оплачиваются в рублях, а нутриками можно оплатить до 30% цены.',
      'Во вкладке «За нутрики» — полезные материалы, которые можно взять целиком за нутрики.',
    ],
  },
  course: {
    emoji: '💳',
    title: 'Покупка курса',
    steps: [
      'Во вкладке «Содержание» посмотрите программу курса.',
      'Включите «Списать нутрики» — они заменят до 30% цены (3 нутрика = 1 ₽).',
      'Нажмите «Купить» и оплатите остаток картой — доступ откроется по коду.',
    ],
  },
  profile: {
    emoji: '👤',
    title: 'Профиль',
    steps: [
      'Здесь ваш результат теста, покупки и статистика.',
      'Пригласите друга по ссылке — получите +1 000 нутриков.',
      'Повторить эту инструкцию можно кнопкой «Как пользоваться приложением».',
    ],
  },
  guide: {
    emoji: '🎁',
    title: 'Ваш гид',
    steps: [
      'Начните с блока «Ваш фокус» — советы подобраны по вашим ответам.',
      'Отмечайте привычки в чек-листе каждый день: +20 нутриков за каждую.',
      'Хотите персональный план — запишитесь на консультацию внизу.',
    ],
  },
};

/** Карточка-подсказка «Как это работает» при первом посещении страницы. */
export function PageTip({ id }: { id: TipId }) {
  const seen = useApp((s) => s.settings.seenTips.includes(id));
  const markSeen = useApp((s) => s.markTipSeen);
  const showTip = useApp((s) => s.showTip);
  if (seen) {
    return (
      <button className="tip-reopen" onClick={() => showTip(id)} aria-label={`Инструкция: ${TIPS[id].title}`}>
        <Icon name="help" size={16} /> Инструкция
      </button>
    );
  }
  const tip = TIPS[id];

  return (
    <section className="page-tip" role="note">
      <div className="row" style={{ gap: 10 }}>
        <span className="page-tip__emoji">{tip.emoji}</span>
        <div style={{ flex: 1 }}>
          <div className="caps" style={{ color: 'var(--violet-600)' }}>
            Как это работает
          </div>
          <div className="h3">{tip.title}</div>
        </div>
        <button className="page-tip__close" onClick={() => markSeen(id)} aria-label="Закрыть подсказку">
          <Icon name="x" size={18} />
        </button>
      </div>
      <ol className="page-tip__steps">
        {tip.steps.map((s, i) => (
          <li key={s}>
            <span>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <button className="btn btn--violet btn--sm btn--block" onClick={() => markSeen(id)}>
        Понятно
      </button>
    </section>
  );
}
