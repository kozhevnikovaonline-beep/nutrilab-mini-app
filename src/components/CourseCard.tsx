import type { CourseDef } from '@shared/courses';
import { useApp } from '../store/appStore';
import { formatCompact } from '../lib/format';
import { Media } from './Media';
import { Coin } from './Coin';
import { Icon } from './Icon';
import { Stars, formatRub } from './ui';

/** Карточка курса: фото, название, цена в рублях и нутриках, рейтинг. */
export function CourseCard({ course, wide = false }: { course: CourseDef; wide?: boolean }) {
  const push = useApp((s) => s.push);
  const owned = useApp((s) => s.user?.purchases.some((p) => p.productId === course.id) ?? false);

  return (
    <button className={`product-card ${wide ? 'product-card--wide' : ''}`} onClick={() => push({ name: 'course', courseId: course.id })}>
      <div className="product-card__media">
        <Media src={course.image} alt={course.title} emoji={course.emoji} />
        {course.badge && <span className="pill pill--white product-card__badge">{course.badge}</span>}
        {owned && (
          <span className="pill pill--dark product-card__owned">
            <Icon name="check" size={14} strokeWidth={3} /> Куплен
          </span>
        )}
      </div>
      <div className="product-card__body">
        <div className="product-card__title">{course.title}</div>
        <div className="small muted">{course.subtitle}</div>
        <div className="course-card__prices">
          <b>{formatRub(course.priceRub)}</b>
          <span className="course-card__coins">
            <Coin size={14} /> {formatCompact(course.priceCoins)}
          </span>
        </div>
        <Stars rating={course.rating} reviews={course.reviews} />
      </div>
    </button>
  );
}
