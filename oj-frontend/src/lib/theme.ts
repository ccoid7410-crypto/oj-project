export type ThemePref = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'oj_theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function storedTheme(): ThemePref {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

function isDark(pref: ThemePref): boolean {
  return pref === 'dark' || (pref === 'system' && media.matches);
}

export function applyTheme(pref: ThemePref) {
  document.documentElement.classList.toggle('dark', isDark(pref));
}

/** 선택값을 저장하고 즉시 적용한다. (계정 저장은 호출부에서 API로 따로 처리) */
export function setTheme(pref: ThemePref) {
  localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(pref);
  // 같은 탭 안에서 셀렉트 UI가 여러 곳에 있어도 동기화되도록 알림
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: pref }));
}

/** 앱 시작 시 1회: 저장된 값 적용 + 시스템 테마 변경 추적(system 모드일 때만 반영). */
export function initTheme() {
  applyTheme(storedTheme());
  media.addEventListener('change', () => applyTheme(storedTheme()));
}
