import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { setTheme, storedTheme, type ThemePref } from '../lib/theme';

/** 누를 때마다 라이트 → 다크 → 시스템 순으로 돈다. */
const ORDER: ThemePref[] = ['light', 'dark', 'system'];

const LABEL: Record<ThemePref, string> = {
  light: '라이트 모드',
  dark: '다크 모드',
  system: '시스템 설정 따름',
};

/**
 * 헤더 전용 테마 버튼. 마이페이지의 `ThemeButtons`와 같은 세 가지(라이트/다크/시스템)를
 * 아이콘 하나로 돌려가며 고른다. 저장소(`oj_theme`)와 `theme-changed` 이벤트를
 * 그대로 공유해서 둘이 항상 같은 값을 가리킨다.
 * 아이콘 크기는 옆의 종 아이콘과 같은 규격(16px 아이콘 / 20px 박스)으로 맞춘다.
 */
export function HeaderThemeToggle() {
  const { user } = useAuth();
  const [pref, setPref] = useState<ThemePref>('system');

  useEffect(() => {
    setPref(storedTheme());
    const sync = () => setPref(storedTheme());
    window.addEventListener('theme-changed', sync);
    return () => window.removeEventListener('theme-changed', sync);
  }, []);

  function next() {
    const value = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setTheme(value);
    setPref(value);
    if (user) api.patch('/users/me/theme', { theme: value }).catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={next}
      title={LABEL[pref]}
      aria-label={`테마: ${LABEL[pref]} (눌러서 변경)`}
      className="flex h-5 w-5 items-center justify-center hover:text-[var(--color-header-fg-hover)]"
    >
      <ThemeIcon pref={pref} />
    </button>
  );
}

function ThemeIcon({ pref }: { pref: ThemePref }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (pref === 'light') {
    // 해
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  }
  if (pref === 'dark') {
    // 달
    return (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
      </svg>
    );
  }
  // 시스템(모니터)
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
