import { useApp, type Tab } from '../store/appStore';
import { Coin } from './Coin';
import { Icon, type IconName } from './Icon';

const ITEMS: { tab: Tab; label: string; icon: IconName }[] = [
  { tab: 'home', label: 'Главная', icon: 'home' },
  { tab: 'quiz', label: 'Тест', icon: 'test' },
  { tab: 'tap', label: 'Фарм', icon: 'leaf' },
  { tab: 'shop', label: 'Магазин', icon: 'bag' },
  { tab: 'profile', label: 'Профиль', icon: 'user' },
];

export function TabBar() {
  const tab = useApp((s) => s.tab);
  const setTab = useApp((s) => s.setTab);

  return (
    <nav className="tabbar" aria-label="Навигация">
      {ITEMS.map((item) =>
        item.tab === 'tap' ? (
          <button
            key={item.tab}
            className="tabbar__center"
            aria-label="Фармить нутрики"
            aria-current={tab === item.tab ? 'page' : undefined}
            onClick={() => setTab(item.tab)}
          >
            <Coin size={38} />
          </button>
        ) : (
          <button
            key={item.tab}
            className="tabbar__item"
            aria-current={tab === item.tab ? 'page' : undefined}
            onClick={() => setTab(item.tab)}
          >
            <Icon name={item.icon} size={22} />
            {item.label}
          </button>
        ),
      )}
    </nav>
  );
}
