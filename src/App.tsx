import { useEffect } from 'react';
import { useApp, type Route } from './store/appStore';
import { isTelegram } from './telegram/webapp';
import { Logo } from './components/Coin';
import { TabBar } from './components/TabBar';
import { Toasts } from './components/ui';
import { HomeScreen } from './screens/HomeScreen';
import { QuizResultScreen, QuizRunScreen, QuizTab } from './screens/QuizScreens';
import { GuideScreen } from './screens/GuideScreen';
import { TapScreen } from './screens/TapScreen';
import { ProductScreen, ShopTab } from './screens/ShopScreens';
import { ProfileScreen } from './screens/ProfileScreen';

function StackScreen({ route }: { route: Route }) {
  switch (route.name) {
    case 'quiz-run':
      return <QuizRunScreen />;
    case 'quiz-result':
      return <QuizResultScreen />;
    case 'guide':
      return <GuideScreen />;
    case 'product':
      return <ProductScreen key={route.productId} productId={route.productId} />;
  }
}

function Splash() {
  return (
    <div className="state splash">
      <Logo size={88} />
      <div className="h2">NutriLab</div>
      <div style={{ opacity: 0.7 }}>Готовим ваш ресурс…</div>
    </div>
  );
}

function BootError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="state">
      <div style={{ fontSize: 48 }}>🍃</div>
      <h1 className="h2">Не удалось загрузить данные</h1>
      <p className="muted">{message}</p>
      <button className="btn btn--primary" onClick={retry}>
        Повторить
      </button>
    </div>
  );
}

export function App() {
  const status = useApp((s) => s.status);
  const error = useApp((s) => s.error);
  const tab = useApp((s) => s.tab);
  const stack = useApp((s) => s.stack);
  const bootstrap = useApp((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Прокрутка в начало при смене вкладки.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  // Блокируем прокрутку фона, пока открыт вложенный экран.
  useEffect(() => {
    document.body.style.overflow = stack.length ? 'hidden' : '';
  }, [stack.length]);

  if (status === 'loading') return <Splash />;
  if (status === 'error') return <BootError message={error ?? ''} retry={bootstrap} />;

  const top = stack[stack.length - 1];

  return (
    <div className={`app ${isTelegram ? 'tg-native-buttons' : ''}`}>
      {tab === 'home' && <HomeScreen />}
      {tab === 'quiz' && <QuizTab />}
      {tab === 'tap' && <TapScreen />}
      {tab === 'shop' && <ShopTab />}
      {tab === 'profile' && <ProfileScreen />}
      {top ? <StackScreen route={top} /> : <TabBar />}
      <Toasts />
    </div>
  );
}
