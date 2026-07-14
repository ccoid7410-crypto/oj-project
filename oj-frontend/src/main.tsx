import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { initTheme } from './lib/theme';

// 렌더 전에 테마를 적용해 라이트→다크 깜빡임(FOUC)을 막는다.
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
