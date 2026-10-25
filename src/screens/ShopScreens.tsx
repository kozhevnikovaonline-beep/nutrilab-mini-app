import { useState } from 'react';
import { PRODUCTS, PRODUCT_CATEGORIES, SCHOOL, type ProductCategory } from '@shared/catalog';
import type { Purchase } from '@shared/types';
import { useApp } from '../store/appStore';
import { useBackButton } from '../telegram/hooks';
import { confirmAction, haptic, openLink } from '../telegram/webapp';
import { links } from '../lib/config';
import { formatCoins, formatDate } from '../lib/format';
import { BalanceChip, Empty, MainAction, PageHead, Price } from '../components/ui';
import { ProductCard } from '../components/ProductCard';
import { Media } from '../components/Media';
import { Icon } from '../components/Icon';

type Filter = 'all' | ProductCategory;

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
  const product = PRODUCTS.find((p) => p.id === purchase.productId);
  const push = useApp((s) => s.push);
  if (!product) return null;
  return (
    <button className="list-item" onClick={() => push({ name: 'product', productId: product.id })}>
      <span className="list-item__icon">{product.emoji}</span>
      <div className="list-item__body">
        <div className="list-item__title">{product.title}</div>
        <div className="list-item__sub">
          {formatDate(purchase.purchasedAt)} · код <b style={{ color: 'var(--ink)' }}>{purchase.code}</b>
        </div>
      </div>
      <Icon name="chevron" size={18} className="muted" />
    </button>
  );
}

export function ShopTab() {
  const purchases = useApp((s) => s.user?.purchases ?? []);
  const setTab = useApp((s) => s.setTab);
  const [segment, setSegment] = useState<'catalog' | 'mine'>('catalog');
  const [filter, setFilter] = useState<Filter>('all');
  const products = filter === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === filter);

  return (
    <main className="screen stack">
      <header className="row">
        <h1 className="h1" style={{ flex: 1 }}>
          Магазин
        </h1>
        <BalanceChip />
      </header>
      <p className="text-2 small" style={{ marginTop: -6 }}>
        Обменивайте нутрики на материалы, курсы и персональную работу со специалистами школы.
      </p>

      <div className="segments" role="tablist">
        <button role="tab" aria-selected={segment === 'catalog'} className="segments__item" onClick={() => setSegment('catalog')}>
          Каталог
        </button>
        <button role="tab" aria-selected={segment === 'mine'} className="segments__item" onClick={() => setSegment('mine')}>
          Мои покупки{purchases.length ? ` · ${purchases.length}` : ''}
        </button>
      </div>

      {segment === 'catalog' ? (
        <>
          <div className="hscroll" style={{ paddingBottom: 0 }}>
            {(['all', ...Object.keys(PRODUCT_CATEGORIES)] as Filter[]).map((f) => (
              <button
                key={f}
                className={`pill ${filter === f ? 'pill--dark' : ''}`}
                style={{ height: 36, padding: '0 16px' }}
                onClick={() => {
                  haptic.select();
                  setFilter(f);
                }}
              >
                {f === 'all' ? 'Все' : PRODUCT_CATEGORIES[f]}
              </button>
            ))}
          </div>
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      ) : purchases.length ? (
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
            text="Копите нутрики в тапалке, проходите тест и выполняйте задания — и обменивайте их на продукты школы."
            action={
              <button className="btn btn--primary btn--sm" style={{ marginTop: 8 }} onClick={() => setTab('tap')}>
                Фармить нутрики
              </button>
            }
          />
        </div>
      )}
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
