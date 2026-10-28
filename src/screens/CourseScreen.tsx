import { useState } from 'react';
import { MAX_COIN_DISCOUNT_SHARE, coinDiscount } from '@shared/pricing';
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
import { PageTip } from '../components/Onboarding';

const LESSON_ICONS: Record<CourseLesson['kind'], IconName> = { video: 'play', practice: 'flag', material: 'file' };

const formatDuration = (minutes: number) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)} ч ${minutes % 60 ? `${minutes % 60} мин` : ''}`.trim() : `${minutes} мин`;

/** Карточка курса или услуги: описание, программа и оплата в рублях со скидкой нутриками до 30%. */
export function CourseScreen({ courseId }: { courseId: string }) {
  const user = useApp((s) => s.user)!;
  const refresh = useApp((s) => s.refresh);
  const toast = useApp((s) => s.toast);
  const pop = useApp((s) => s.pop);
  const setTab = useApp((s) => s.setTab);
  const [section, setSection] = useState<'about' | 'program'>('about');
  const [useCoins, setUseCoins] = useState(true);
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
  const isService = course.kind === 'service';
  const lessons = courseLessonCount(course);
  const discount = coinDiscount(course.priceRub, user.game.balance);
  const applyCoins = useCoins && discount.rub > 0;
  const toPay = applyCoins ? discount.finalRub : course.priceRub;
  const managerText = (extra: string) => `Здравствуйте! ${extra} «${course.title}» (${SCHOOL.name}).`;

  /** Заявка менеджеру — когда онлайн-оплата недоступна (демо-режим или платежи не подключены). */
  const requestViaManager = async () => {
    const discountNote = applyCoins
      ? ` со скидкой нутриками −${formatRub(discount.rub)} (спишу ${formatCoins(discount.coins)} нутриков)`
      : '';
    const ok = await confirmAction(
      `Онлайн-оплата картой будет доступна после подключения платёжной системы. Сейчас менеджер пришлёт вам ссылку на оплату ${formatRub(toPay)}. Написать менеджеру?`,
    );
    if (ok) openLink(links.manager(managerText(`Хочу купить за ${formatRub(toPay)}${discountNote}:`)));
  };

  const buy = async () => {
    if (!api.createInvoice) return requestViaManager();
    setPaying(true);
    try {
      const { invoiceUrl } = await api.createInvoice(course.id, applyCoins);
      const status = await openInvoice(invoiceUrl);
      if (status === 'paid') {
        haptic.success();
        toast('Оплата прошла! Открываем доступ…', 'success');
        // Сервер выдаёт курс и списывает нутрики по событию successful_payment — даём ему пару секунд.
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

  const startLearning = () =>
    purchase && openLink(links.manager(managerText(`Я оплатил(а), мой код ${purchase.code}. Откройте, пожалуйста, доступ:`)));

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
          <button role="tab" aria-selected={section === 'about'} onClick={() => setSection('about')}>
            Описание
          </button>
          <button role="tab" aria-selected={section === 'program'} onClick={() => setSection('program')}>
            {isService ? 'Как проходит' : 'Содержание'}
          </button>
        </div>

        <div>
          <h1 className="h2">{course.title}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {isService ? course.subtitle : `${course.subtitle} · ${course.level} уровень`}
          </p>
        </div>

        <div className="chips">
          <span className="chip">
            <Icon name="users" size={15} /> {formatCoins(course.students)}{' '}
            {isService ? pluralize(course.students, ['клиент', 'клиента', 'клиентов']) : pluralize(course.students, ['ученик', 'ученика', 'учеников'])}
          </span>
          {isService ? (
            <span className="chip">
              <Icon name="clock" size={15} /> {course.format}
            </span>
          ) : (
            <>
              <span className="chip">
                <Icon name="play" size={15} /> {lessons} {pluralize(lessons, ['урок', 'урока', 'уроков'])}
              </span>
              <span className="chip">
                <Icon name="flag" size={15} /> {course.practices} {pluralize(course.practices, ['практика', 'практики', 'практик'])}
              </span>
            </>
          )}
        </div>

        <div className="row">
          <Stars rating={course.rating} reviews={course.reviews} />
          <span className="spacer" />
          {!isService && (
            <span className="small muted">
              <Icon name="clock" size={14} /> {formatDuration(courseMinutes(course))}
            </span>
          )}
        </div>

        <PageTip id="course" />

        <section className="price-box">
          <div>
            <div className="small muted">{isService ? 'Стоимость' : 'Цена курса'}</div>
            <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
              <b className="price-box__rub">{formatRub(course.priceRub)}</b>
              {course.oldPriceRub && <s className="muted small">{formatRub(course.oldPriceRub)}</s>}
            </div>
          </div>
          {!purchase && applyCoins && (
            <div style={{ textAlign: 'right' }}>
              <div className="small muted">С нутриками</div>
              <b className="price-box__final">{formatRub(discount.finalRub)}</b>
            </div>
          )}
        </section>

        {!purchase &&
          (discount.rub > 0 ? (
            <label className="coin-discount">
              <span className="coin-discount__icon">
                <Coin size={26} />
              </span>
              <span style={{ flex: 1 }}>
                <b>
                  Списать нутрики: <span style={{ whiteSpace: 'nowrap' }}>−{formatRub(discount.rub)}</span>
                </b>
                <span className="small muted" style={{ display: 'block' }}>
                  Спишется {formatCoins(discount.coins)} из {formatCoins(user.game.balance)} · 1 нутрик = 1 ₽ · до{' '}
                  {Math.round(MAX_COIN_DISCOUNT_SHARE * 100)}% цены
                </span>
              </span>
              <input type="checkbox" className="switch" checked={useCoins} onChange={(e) => setUseCoins(e.target.checked)} />
            </label>
          ) : (
            <button className="coin-discount" onClick={() => setTab('tap')}>
              <span className="coin-discount__icon">
                <Coin size={26} />
              </span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <b>Скидка до {Math.round(MAX_COIN_DISCOUNT_SHARE * 100)}% нутриками</b>
                <span className="small muted" style={{ display: 'block' }}>
                  1 нутрик = 1 ₽. Накопите нутрики и оплатите ими до −{formatRub(discount.maxRub)}
                </span>
              </span>
              <Icon name="chevron" size={18} />
            </button>
          ))}

        {purchase && (
          <section className="card card--lime stack" style={{ gap: 8 }}>
            <div className="caps" style={{ color: 'var(--green-600)' }}>
              {isService ? 'Оплачено' : 'Курс ваш'} · {purchase.method === 'coins' ? 'обменян на нутрики' : 'оплачен картой'}
              {purchase.coinsSpent ? ` · −${formatCoins(purchase.coinsSpent)} нутриков` : ''}
            </div>
            <div className="row">
              <span className="purchase-code">{purchase.code}</span>
            </div>
            <p className="small text-2">Нажмите «Начать обучение» — куратор откроет доступ по этому коду.</p>
          </section>
        )}

        {section === 'about' ? (
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
          course.program.map((part, i) => (
            <section key={`${part.title}-${i}`} className="card program">
              {!isService && <div className="caps muted">Раздел {i + 1}</div>}
              <div className="h3" style={{ marginBottom: 6 }}>
                {part.title.replace(/^.*?\.\s/, '')}
              </div>
              {part.lessons.map((lesson, j) => (
                <div key={`${lesson.title}-${j}`} className="program__lesson">
                  <Icon name={purchase || isService ? LESSON_ICONS[lesson.kind] : 'lock'} size={16} />
                  <span style={{ flex: 1 }}>
                    {isService ? `Шаг ${j + 1}` : `Урок №${j + 1}`}: {lesson.title}
                  </span>
                  <span className="small muted">{lesson.minutes} мин</span>
                </div>
              ))}
            </section>
          ))
        )}
      </div>

      {purchase ? (
        <MainAction text={isService ? 'Связаться с куратором' : 'Начать обучение'} onClick={startLearning} />
      ) : (
        <MainAction tone="violet" text={`Купить за ${formatRub(toPay)}`} onClick={buy} loading={paying} />
      )}
    </main>
  );
}
