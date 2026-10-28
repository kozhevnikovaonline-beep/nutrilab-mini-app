import { useState } from 'react';
import { SCHOOL } from '@shared/catalog';
import { COURSE_CATEGORIES, EXPERT_PHOTO, courseLessonCount, courseMinutes, findCourse, type CourseLesson } from '@shared/courses';
import { useApp } from '../store/appStore';
import { useBackButton } from '../telegram/hooks';
import { confirmAction, haptic, openInvoice, openLink } from '../telegram/webapp';
import { api, ApiError } from '../api';
import { links } from '../lib/config';
import { formatCoins, pluralize } from '../lib/format';
import { Empty, MainAction, PageHead, Stars, formatRub } from '../components/ui';
import { Media } from '../components/Media';
import { Icon, type IconName } from '../components/Icon';
import { Coin } from '../components/Coin';

const LESSON_ICONS: Record<CourseLesson['kind'], IconName> = { video: 'play', practice: 'flag', material: 'file' };

const formatDuration = (minutes: number) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)} ч ${minutes % 60 ? `${minutes % 60} мин` : ''}`.trim() : `${minutes} мин`;

/** Карточка курса: описание, программа и покупка за рубли или нутрики. */
export function CourseScreen({ courseId }: { courseId: string }) {
  const user = useApp((s) => s.user)!;
  const run = useApp((s) => s.run);
  const refresh = useApp((s) => s.refresh);
  const toast = useApp((s) => s.toast);
  const pop = useApp((s) => s.pop);
  const coinsBusy = useApp((s) => s.busy['product/buy']);
  const [tab, setTab] = useState<'about' | 'program'>('about');
  const [paying, setPaying] = useState(false);
  useBackButton(pop);

  const course = findCourse(courseId);
  if (!course) {
    return (
      <main className="screen screen--stack">
        <PageHead />
        <Empty emoji="🔎" title="Курс не найден" text="Возможно, он больше не продаётся." />
      </main>
    );
  }

  const purchase = user.purchases.find((p) => p.productId === course.id);
  const missingCoins = course.priceCoins - user.game.balance;
  const lessons = courseLessonCount(course);
  const managerText = (extra: string) => `Здравствуйте! ${extra} «${course.title}» (${SCHOOL.name}).`;

  /** Заявка менеджеру — когда онлайн-оплата недоступна (демо-режим или платежи не подключены). */
  const requestViaManager = async () => {
    const ok = await confirmAction(
      `Онлайн-оплата картой будет доступна после подключения платёжной системы. Сейчас менеджер пришлёт вам ссылку на оплату ${formatRub(course.priceRub)}. Написать менеджеру?`,
    );
    if (ok) openLink(links.manager(managerText(`Хочу купить курс за ${formatRub(course.priceRub)}:`)));
  };

  const buyRub = async () => {
    if (!api.createInvoice) return requestViaManager();
    setPaying(true);
    try {
      const { invoiceUrl } = await api.createInvoice(course.id);
      const status = await openInvoice(invoiceUrl);
      if (status === 'paid') {
        haptic.success();
        toast('Оплата прошла! Открываем доступ…', 'success');
        // Сервер выдаёт курс по событию successful_payment — даём ему пару секунд.
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
      } else if (status === 'failed') {
        toast('Оплата не прошла. Попробуйте ещё раз', 'error');
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PAYMENTS_DISABLED') await requestViaManager();
      else toast(err instanceof ApiError ? err.message : 'Не удалось создать счёт', 'error');
    } finally {
      setPaying(false);
    }
  };

  const buyCoins = async () => {
    const ok = await confirmAction(`Обменять ${formatCoins(course.priceCoins)} нутриков на курс «${course.title}»?`);
    if (!ok) return;
    const result = await run({ type: 'product/buy', productId: course.id });
    if (result?.effect.purchase) toast('Курс ваш! 🎉', 'success');
  };

  const startLearning = () =>
    purchase && openLink(links.manager(managerText(`Я оплатил(а) курс, мой код ${purchase.code}. Откройте, пожалуйста, доступ к курсу`)));

  return (
    <main className="screen screen--stack course">
      <div className="course__cover">
        <Media src={course.image} alt={course.title} emoji={course.emoji} />
        <img className="course__author" src={EXPERT_PHOTO} alt={SCHOOL.expert.name} />
      </div>

      <div className="course__sheet stack">
        <PageHead
          title={<span className="pill pill--lime">{COURSE_CATEGORIES[course.category]}</span>}
          right={course.badge ? <span className="pill pill--violet">{course.badge}</span> : undefined}
        />

        <div className="tabs-pills" role="tablist">
          <button role="tab" aria-selected={tab === 'about'} onClick={() => setTab('about')}>
            Описание
          </button>
          <button role="tab" aria-selected={tab === 'program'} onClick={() => setTab('program')}>
            Содержание
          </button>
        </div>

        <div>
          <h1 className="h2">{course.title}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {course.subtitle} · {course.level} уровень
          </p>
        </div>

        <div className="chips">
          <span className="chip">
            <Icon name="users" size={15} /> {formatCoins(course.students)} {pluralize(course.students, ['ученик', 'ученика', 'учеников'])}
          </span>
          <span className="chip">
            <Icon name="play" size={15} /> {lessons} {pluralize(lessons, ['урок', 'урока', 'уроков'])}
          </span>
          <span className="chip">
            <Icon name="flag" size={15} /> {course.practices} {pluralize(course.practices, ['практика', 'практики', 'практик'])}
          </span>
        </div>

        <div className="row">
          <Stars rating={course.rating} reviews={course.reviews} />
          <span className="spacer" />
          <span className="small muted">
            <Icon name="clock" size={14} /> {formatDuration(courseMinutes(course))}
          </span>
        </div>

        <section className="price-box">
          <div>
            <div className="small muted">Цена курса</div>
            <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
              <b className="price-box__rub">{formatRub(course.priceRub)}</b>
              {course.oldPriceRub && <s className="muted small">{formatRub(course.oldPriceRub)}</s>}
            </div>
          </div>
          <div className="price-box__or">или</div>
          <div style={{ textAlign: 'right' }}>
            <div className="small muted">За нутрики</div>
            <b className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
              <Coin size={18} /> {formatCoins(course.priceCoins)}
            </b>
          </div>
        </section>

        {purchase && (
          <section className="card card--lime stack" style={{ gap: 8 }}>
            <div className="caps" style={{ color: 'var(--green-600)' }}>
              Курс ваш · {purchase.method === 'rub' ? 'оплачен картой' : 'обменян на нутрики'}
            </div>
            <div className="row">
              <span className="purchase-code">{purchase.code}</span>
            </div>
            <p className="small text-2">Нажмите «Начать обучение» — куратор откроет доступ по этому коду.</p>
          </section>
        )}

        {tab === 'about' ? (
          <>
            <p className="text-2">{course.description}</p>
            <section className="card stack" style={{ gap: 12 }}>
              <p className="h3">Чему вы научитесь</p>
              <ul className="bullets">
                {course.outcomes.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </section>
            <section className="card stack" style={{ gap: 12 }}>
              <p className="h3">Кому подойдёт</p>
              <ul className="bullets">
                {course.forWhom.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </section>
            <section className="card row" style={{ alignItems: 'flex-start' }}>
              <img className="expert-photo" src={EXPERT_PHOTO} alt="" />
              <div>
                <div className="h3">{SCHOOL.expert.name}</div>
                <div className="small muted">{SCHOOL.expert.role}</div>
                <p className="small text-2" style={{ marginTop: 6 }}>
                  {course.curator ? 'Поддержка профессиональных кураторов в чате на протяжении курса.' : 'Самостоятельное обучение в удобном темпе.'} Доступ{' '}
                  {course.accessDays} дней.
                </p>
              </div>
            </section>
          </>
        ) : (
          course.program.map((section, i) => (
            <section key={section.title} className="card program">
              <div className="caps muted">Раздел {i + 1}</div>
              <div className="h3" style={{ marginBottom: 6 }}>
                {section.title.replace(/^.*?\.\s/, '')}
              </div>
              {section.lessons.map((lesson, j) => (
                <div key={lesson.title} className="program__lesson">
                  <Icon name={purchase ? LESSON_ICONS[lesson.kind] : 'lock'} size={16} />
                  <span style={{ flex: 1 }}>
                    Урок №{j + 1}: {lesson.title}
                  </span>
                  <span className="small muted">{lesson.minutes} мин</span>
                </div>
              ))}
            </section>
          ))
        )}
      </div>

      {purchase ? (
        <MainAction text="Начать обучение" onClick={startLearning} />
      ) : (
        <MainAction
          tone="violet"
          text={`Купить за ${formatRub(course.priceRub)}`}
          onClick={buyRub}
          loading={paying}
          secondary={{
            text: missingCoins > 0 ? `Не хватает ${formatCoins(missingCoins)} нутриков` : `Купить за ${formatCoins(course.priceCoins)} нутриков`,
            onClick: buyCoins,
            disabled: missingCoins > 0,
            loading: coinsBusy,
          }}
        />
      )}
    </main>
  );
}
