import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { setTheme } from '../lib/theme';

function currentlyDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

/**
 * 헤더 전용 간단 토글(☀/☾). `system`은 다루지 않고 라이트/다크 둘만 오간다 -
 * 3단 선택은 마이페이지의 `ThemeButtons`가 이미 담당하므로 헤더는 최소 UI만.
 * 저장소(`oj_theme`)와 `theme-changed` 이벤트를 그대로 공유해서 둘이 항상 동기화된다.
 */
export function HeaderThemeToggle() {
  const { user } = useAuth();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(currentlyDark());
    const sync = () => setDark(currentlyDark());
    window.addEventListener('theme-changed', sync);
    return () => window.removeEventListener('theme-changed', sync);
  }, []);

  function toggle() {
    const next = dark ? 'light' : 'dark';
    setTheme(next);
    setDark(!dark);
    if (user) api.patch('/users/me/theme', { theme: next }).catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className="text-[14px] leading-none hover:text-[var(--color-header-fg-hover)]"
    >
      {dark ? '☾' : '☀'}
    </button>
  );
}
