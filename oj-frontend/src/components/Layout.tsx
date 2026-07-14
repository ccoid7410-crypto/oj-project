import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBrandName } from '../lib/useBrandName';
import { api } from '../api/client';
import { setTheme, storedTheme, type ThemePref } from '../lib/theme';

const THEME_OPTIONS: Array<{ value: ThemePref; label: string; icon: string }> = [
  { value: 'system', label: '시스템', icon: '💻' },
  { value: 'light', label: '라이트', icon: '☀️' },
  { value: 'dark', label: '다크', icon: '🌙' },
];

/** OS 기본 select 팝업 대신 사이트 스타일에 맞춘 커스텀 테마 드롭다운. */
function ThemeSelect() {
  const { user } = useAuth();
  const [pref, setPref] = useState<ThemePref>(storedTheme());
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 로그인 시 계정 테마가 적용(setTheme)되면 표시값도 따라가게 한다.
  useEffect(() => {
    const sync = () => setPref(storedTheme());
    window.addEventListener('theme-changed', sync);
    return () => window.removeEventListener('theme-changed', sync);
  }, []);

  // 바깥 클릭 / ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(next: ThemePref) {
    setPref(next);
    setTheme(next);
    setOpen(false);
    // 로그인 상태면 계정에도 저장해 다른 기기에서도 이어지게 한다.
    if (user) api.patch('/users/me/theme', { theme: next }).catch(() => {});
  }

  const current = THEME_OPTIONS.find((o) => o.value === pref)!;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="테마"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors ${
          open
            ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
            : 'border-ink-500 text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]'
        }`}
      >
        <span aria-hidden>{current.icon}</span>
        {current.label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden
          className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1 w-32 overflow-hidden rounded border border-ink-500 bg-white py-1 shadow-lg"
        >
          {THEME_OPTIONS.map((opt) => (
            <li key={opt.value} role="option" aria-selected={pref === opt.value}>
              <button
                type="button"
                onClick={() => choose(opt.value)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-ink-700 ${
                  pref === opt.value ? 'font-bold text-[var(--color-brand)]' : 'text-fg'
                }`}
              >
                <span aria-hidden>{opt.icon}</span>
                {opt.label}
                {pref === opt.value && (
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="ml-auto">
                    <path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const brandName = useBrandName();
  const [unreadCount, setUnreadCount] = useState(0);

  // 관리자가 대량 생성한 계정은 최초 로그인 후 비밀번호를 바꾸기 전까지 다른 화면을 못 쓰게 막는다.
  useEffect(() => {
    if (user?.mustChangePassword && location.pathname !== '/change-password') {
      navigate('/change-password', { replace: true });
    }
  }, [user?.mustChangePassword, location.pathname, navigate]);

  // 이름(실명)이 없는 계정은 등록할 때까지 다른 화면을 못 쓰게 막는다. 비밀번호 강제 변경이 우선.
  useEffect(() => {
    if (!user || user.mustChangePassword) return;
    if (!user.name && location.pathname !== '/register-name') {
      navigate('/register-name', { replace: true });
    }
  }, [user, location.pathname, navigate]);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    const load = () => {
      api
        .get<{ count: number }>('/admin/notifications/unread-count')
        .then((r) => setUnreadCount(r.count))
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 30_000);
    window.addEventListener('notifications-updated', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('notifications-updated', load);
    };
  }, [user?.role]);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-ink-500 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-4 pb-2">
          <Link to="/" className="leading-none">
            <div className="flex items-baseline gap-1 text-xl font-black tracking-tight text-[var(--color-logo)]">
              {brandName}
              <span className="text-[var(--color-brand)]">&gt;</span>
            </div>
            <div className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-fg-muted">
              ONLINE JUDGE
            </div>
          </Link>
          <div className="flex items-center gap-3 text-xs text-fg-muted">
            <ThemeSelect />
            {user ? (
              <>
                <Link to={`/users/${user.username}`} className="hover:text-[var(--color-brand)]">
                  {user.username}
                  <span className="ml-1 text-[var(--color-brand)]">{user.rating}</span>
                </Link>
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="hover:text-[var(--color-brand)]"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  // 로그인 후 지금 보던 페이지로 돌아올 수 있게 현재 위치를 redirect로 넘긴다
                  to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
                  className="hover:text-[var(--color-brand)]"
                >
                  로그인
                </Link>
                <Link to="/signup" className="hover:text-[var(--color-brand)]">
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl items-center gap-6 border-t border-ink-600 px-6 text-sm font-medium">
          <Link
            to="/problems"
            className="border-b-2 border-transparent py-2.5 text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          >
            문제
          </Link>
          <Link
            to="/contests"
            className="border-b-2 border-transparent py-2.5 text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          >
            대회
          </Link>
          <Link
            to="/ranking"
            className="border-b-2 border-transparent py-2.5 text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          >
            랭킹
          </Link>
          {user && (
            <Link
              to="/submissions"
              className="border-b-2 border-transparent py-2.5 text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              채점 현황
            </Link>
          )}
          {user && (
            <Link
              to="/problems/mine"
              className="border-b-2 border-transparent py-2.5 text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              내 문제
            </Link>
          )}
          {user && (
            <Link
              to="/classes"
              className="border-b-2 border-transparent py-2.5 text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              수업
            </Link>
          )}
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className="border-b-2 border-transparent py-2.5 text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              관리자
            </Link>
          )}
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin/notifications"
              className="relative border-b-2 border-transparent py-2.5 text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              알림
              {unreadCount > 0 && (
                <span className="ml-1 rounded-full bg-[var(--color-wa)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          )}
          {/* 동아리 홈페이지로 이동 — 홈페이지의 "Online Judge ↗" 버튼과 같은 위치(메뉴 오른쪽 끝)·같은 모양.
              홈페이지는 React 밖의 정적 사이트라 Link 대신 일반 앵커를 쓴다. */}
          <a
            href="/home/"
            className="ml-auto border-b-2 border-transparent py-2.5 text-[var(--color-brand)] hover:border-[var(--color-brand)]"
          >
            Durunuri ↗
          </a>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
