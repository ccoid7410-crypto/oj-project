import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBrandName } from '../lib/useBrandName';
import { api } from '../api/client';

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
            <div className="flex items-baseline gap-1 text-xl font-black tracking-tight text-[#1a2b4c]">
              {brandName}
              <span className="text-[var(--color-brand)]">&gt;</span>
            </div>
            <div className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-fg-muted">
              ONLINE JUDGE
            </div>
          </Link>
          <div className="flex items-center gap-3 text-xs text-fg-muted">
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
