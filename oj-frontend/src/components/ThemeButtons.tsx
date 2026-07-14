import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { setTheme, storedTheme, type ThemePref } from '../lib/theme';

const OPTIONS: Array<{ value: ThemePref; label: string }> = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

/** 프로필 페이지용 테마 선택 버튼 3개. 헤더 드롭다운과 같은 저장소(oj_theme)를 공유한다. */
export function ThemeButtons() {
  const { user } = useAuth();
  const [pref, setPref] = useState<ThemePref>(storedTheme());

  useEffect(() => {
    const sync = () => setPref(storedTheme());
    window.addEventListener('theme-changed', sync);
    return () => window.removeEventListener('theme-changed', sync);
  }, []);

  function choose(next: ThemePref) {
    setPref(next);
    setTheme(next);
    if (user) api.patch('/users/me/theme', { theme: next }).catch(() => {});
  }

  return (
    <div className="flex gap-1.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => choose(opt.value)}
          className={`rounded border px-2.5 py-1 text-xs transition-colors ${
            pref === opt.value
              ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 font-bold text-[var(--color-brand)]'
              : 'border-ink-500 text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
