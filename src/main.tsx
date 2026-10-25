import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initTelegram } from './telegram/webapp';
import { App } from './App';
import { ErrorBoundary } from './components/ui';
import './styles/global.css';
import './styles/screens.css';

initTelegram();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
