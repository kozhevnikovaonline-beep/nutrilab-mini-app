import { useState } from 'react';
import { PRODUCTS, PRODUCT_CATEGORIES, SCHOOL } from '@shared/catalog';
import { COURSES, COURSE_CATEGORIES, findCourse, type CourseCategory } from '@shared/courses';
import type { Purchase } from '@shared/types';
import { useApp } from '../store/appStore';
import { useBackButton } from '../telegram/hooks';
import { confirmAction, haptic, openLink } from '../telegram/webapp';
import { links } from '../lib/config';
import { formatCoins, formatDate } from '../lib/format';
import { AccentTitle, BalanceChip, Empty, MainAction, PageHead, Price } from '../components/ui';
import { ProductCard } from '../components/ProductCard';
import { CourseCard } from '../components/CourseCard';
import { PageTip } from '../components/Onboarding';
import { Media } from '../components/Media';
import { Icon } from '../components/Icon';

type Segment = 'courses' | 'bonus' | 'mine';
type Filter = 'all' | CourseCategory;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function activationMessage(productTitle: string, code: string) {
  return `Здравствуйте! Хочу активировать «${productTitle}» из магазина ${SCHOOL.name}. Мой код: ${code}`;
}

function PurchaseRow({ purchase }: { purchase: Purchase }) {
  const push = useApp((s) => s.push);
  const course = findCourse(purchase.productId);
  const product = PRODUCTS.find((p) => p.id === purchase.productId);
  const item = course ?? product;
  if (!item) return null;
  return (
    <button
      className="list-item"
      onClick={() => push(course ? { name: 'course', courseId: course.id } : { name: 'product', productId: item.id })}
    >
      <span className="list-item__icon">{item.emoji}</span>
      <div className="list-item__body">
        <div className="list-item__title">{item.title}</div>
        <div className="list-item__sub">
          {formatDate(purchase.purchasedAt)} · {purchase.method === 'rub' ? 'картой' : 'за нутрики'} · код{' '}
          <b style={{ color: 'var(--ink)' }}>{purchase.code}</b>
        </div>
      </div>
      <Icon name="chevron" size={18} className="muted" />
    </button>
  );
}

const normalize = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Вкладка «Курсы»: курсы и консультации за ₽ (скидка нутриками до 30%), материалы за нутрики и мои покупки. */
export function ShopTab() {
  const purchases = useApp((s) => s.user?.purchases ?? []);
  const setTab = useApp((s) => s.setTab);
  const [segment, setSegment] = useState<Segment>('courses');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const q = normalize(query.trim());
  const courses = COURSES.filter(
    (c) =>
      (filter === 'all' || c.category === filter) &&
      (!q || normalize(`${c.title} ${c.subtitle} ${c.description}`).includes(q)),
  );

  const select = (s: Segment) => {
    haptic.select();
    setSegment(s);
  };

  return (
    <main className="screen stack">
      <header className="row">
        <AccentTitle as="h1" className="h1" text="Курсы" accent="нутрициолога" />
        <span className="spacer" />
        <BalanceChip />
      </header>

      <PageTip id="shop" />

      <label className="search">
        <Icon name="search" size={20} />
        <input
          type="search"
          placeholder="Введите запрос"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (segment !== 'courses') setSegment('courses');
          }}
          enterKeyHint="search"
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="Очистить">
            <Icon name="x" size={18} />
          </button>
        )}
      </label>

      <div className="segments" role="tablist">
        <button role="tab" aria-selected={segment === 'courses'} className="segments__item" onClick={() => select('courses')}>
          Курсы
        </button>
        <button role="tab" aria-selected={segment === 'bonus'} className="segments__item" onClick={() => select('bonus')}>
          За нутрики
        </button>
        <button role="tab" aria-selected={segment === 'mine'} className="segments__item" onClick={() => select('mine')}>
          Мои{purchases.length ? ` · ${purchases.length}` : ''}
        </button>
      </div>

      {segment === 'courses' && (
        <>
          <div className="hscroll" style={{ paddingBottom: 4 }}>
            {(['all', ...Object.keys(COURSE_CATEGORIES)] as Filter[]).map((f) => (
              <button
                key={f}
                className="filter-chip"
                aria-pressed={filter === f}
                onClick={() => {
                  haptic.select();
                  setFilter(f);
                }}
              >
                {f === 'all' ? 'Все курсы' : COURSE_CATEGORIES[f]}
              </button>
            ))}
          </div>
          {courses.length ? (
            <div className="product-grid">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          ) : (
            <div className="card">
              <Empty emoji="🔎" title="Ничего не нашли" text="Попробуйте другой запрос или посмотрите все курсы." />
            </div>
          )}
          <div className="notice">
            <span aria-hidden="true">💳</span>
            <span>
              Все курсы и консультации оплачиваются в рублях. Накопленные нутрики можно списать как скидку до 30% цены — включите её на странице курса.
            </span>
          </div>
        </>
      )}

      {segment === 'bonus' && (
        <>
          <p className="text-2 small">Полезные материалы школы — целиком за нутрики. Курсы и консультации — в разделе «Курсы» со скидкой нутриками до 30%.</p>
          <div className="product-grid">
            {PRODUCTS.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}

      {segment === 'mine' &&
        (purchases.length ? (
          <div className="list">
            {purchases.map((p) => (
              <PurchaseRow key={p.id} purchase={p} />
            ))}
          </div>
        ) : (
          <div className="card">
            <Empty
              emoji="🛍️"
              title="Покупок пока нет"
              text="Купите курс картой или копите нутрики в тапалке, проходите тест и выполняйте задания — и обменивайте их на продукты школы."
              action={
                <button className="btn btn--primary btn--sm" style={{ marginTop: 8 }} onClick={() => setTab('tap')}>
                  Фармить нутрики
                </button>
              }
            />
          </div>
        ))}
    </main>
  );
}

export function ProductScreen({ productId }: { productId: string }) {
  const user = useApp((s) => s.user)!;
  const run = useApp((s) => s.run);
  const busy = useApp((s) => s.busy['product/buy']);
  const pop = useApp((s) => s.pop);
  const toast = useApp((s) => s.toast);
  useBackButton(pop);

  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    return (
      <main className="screen screen--stack">
        <PageHead />
        <Empty emoji="🔎" title="Продукт не найден" text="Возможно, он больше не продаётся." />
      </main>
    );
  }

  const purchase = user.purchases.find((p) => p.productId === product.id);
  const missing = product.price - user.game.balance;

  const buy = async () => {
    const ok = await confirmAction(`Обменять ${formatCoins(product.price)} нутриков на «${product.title}»?`);
    if (!ok) return;
    const result = await run({ type: 'product/buy', productId: product.id });
    if (result?.effect.purchase) toast('Покупка оформлена 🎉', 'success');
  };

  const activate = () => purchase && openLink(links.manager(activationMessage(product.title, purchase.code)));

  const copy = async () => {
    if (purchase && (await copyText(purchase.code))) {
      haptic.success();
      toast('Код скопирован', 'info');
    }
  };

  return (
    <main className="screen screen--stack product">
      <div className="product__media">
        <Media src={product.image} alt={product.title} emoji={product.emoji} />
        <div className="product__media-shade" />
      </div>
      <div className="product__sheet stack">
        <PageHead
          title={<span className="pill pill--lime">{PRODUCT_CATEGORIES[product.category]}</span>}
          right={product.badge ? <span className="pill pill--dark">{product.badge}</span> : undefined}
        />
        <div>
          <h1 className="h2">{product.title}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {product.subtitle}
          </p>
        </div>
        <div className="row">
          <Price value={product.price} size={24} />
          <span className="spacer" />
          {!purchase && missing > 0 && <span className="small muted">не хватает {formatCoins(missing)}</span>}
        </div>

        {purchase && (
          <section className="card card--lime stack" style={{ gap: 10 }}>
            <div className="caps" style={{ opacity: 0.7 }}>
              Ваш код
            </div>
            <div className="row">
              <span className="purchase-code">{purchase.code}</span>
              <span className="spacer" />
              <button className="icon-btn" style={{ background: 'rgba(255,255,255,.6)' }} onClick={copy} aria-label="Скопировать код">
                <Icon name="copy" size={18} />
              </button>
            </div>
            <p className="small" style={{ opacity: 0.8 }}>
              {product.delivery}. Отправьте код менеджеру — это займёт пару секунд.
            </p>
          </section>
        )}

        <p className="text-2">{product.description}</p>

        <section className="card stack" style={{ gap: 12 }}>
          <p className="h3">Что входит</p>
          <ul className="bullets">
            {product.includes.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <div className="row small muted" style={{ gap: 8 }}>
            <Icon name="gift" size={16} /> {product.delivery}
          </div>
        </section>
      </div>

      {purchase ? (
        <MainAction text="Активировать у менеджера" onClick={activate} />
      ) : (
        <MainAction
          text={missing > 0 ? `Не хватает ${formatCoins(missing)} нутриков` : `Купить за ${formatCoins(product.price)} нутриков`}
          onClick={buy}
          disabled={missing > 0}
          loading={busy}
        />
      )}
    </main>
  );
}
