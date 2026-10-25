import type { ProductDef } from '@shared/catalog';
import { useApp } from '../store/appStore';
import { Media } from './Media';
import { Price } from './ui';
import { Icon } from './Icon';

export function ProductCard({ product, wide = false }: { product: ProductDef; wide?: boolean }) {
  const push = useApp((s) => s.push);
  const owned = useApp((s) => s.user?.purchases.some((p) => p.productId === product.id) ?? false);

  return (
    <button className={`product-card ${wide ? 'product-card--wide' : ''}`} onClick={() => push({ name: 'product', productId: product.id })}>
      <div className="product-card__media">
        <Media src={product.image} alt={product.title} emoji={product.emoji} />
        {product.badge && <span className="pill pill--lime product-card__badge">{product.badge}</span>}
        {owned && (
          <span className="pill pill--dark product-card__owned">
            <Icon name="check" size={14} strokeWidth={3} /> Ваше
          </span>
        )}
      </div>
      <div className="product-card__body">
        <div className="product-card__title">{product.title}</div>
        <div className="small muted">{product.subtitle}</div>
        <div className="product-card__price">
          <Price value={product.price} />
        </div>
      </div>
    </button>
  );
}
