import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { HeaderThemeToggle } from '../../components/HeaderThemeToggle';
import './club-layout.css';

/**
 * club-homepage/index.html의 헤더/네비를 그대로 옮긴 것. OJ 공용 Layout(Layout.tsx)
 * 대신 /home/* 라우트에서만 이 헤더를 써서, 예전처럼 독립된 사이트처럼 보이게 한다
 * (사용자 확인: "원래는 페이지 자체가 분리되어서 헤더 따로 썼는데" - 그 구조를 되살림).
 */
export function ClubLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const load = () => {
      api
        .get<{ count: number }>('/notifications/unread-count')
        .then((r) => setUnreadCount(r.count))
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 60_000);
    window.addEventListener('user-notifications-updated', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('user-notifications-updated', load);
    };
  }, [user]);

  const current = (path: string) => (location.pathname === path ? 'page' : undefined);
  const inCommunitySection = location.pathname.startsWith('/home/community') || location.pathname.startsWith('/home/club-board') || location.pathname === '/home/exam-scope';

  return (
    <div className="club-page">
      <header className="site-header">
        <div className="site-header-bar">
          <Link to="/home" className="logo">
            <span className="logo-title">
              Durunuri<span className="logo-accent">&gt;</span>
            </span>
            <span className="logo-subtitle">CBSH 정보과</span>
          </Link>
          <nav className="header-nav">
            <Link to="/home/hall-of-fame" aria-current={current('/home/hall-of-fame')}>
              명예의 전당
            </Link>
            <div className="header-nav-menu">
              <Link to="/home/community" className="header-nav-trigger" aria-current={inCommunitySection ? 'page' : undefined}>
                커뮤니티 <span aria-hidden="true">▾</span>
              </Link>
              <div className="header-mega-menu">
                <div className="header-mega-inner">
                  <Link to="/home/community" aria-current={current('/home/community')}>
                    공개 게시판
                  </Link>
                  <Link to="/home/club-board" aria-current={current('/home/club-board')}>
                    동아리 게시판
                  </Link>
                  <Link to="/home/exam-scope" aria-current={current('/home/exam-scope')}>
                    시험범위
                  </Link>
                </div>
              </div>
            </div>
            <Link to="/home/calendar" aria-current={current('/home/calendar')}>
              일정
            </Link>
            <a href="https://cbgpu.vercel.app/" target="_blank" rel="noopener noreferrer">
              CBGPU
            </a>
            <Link to="/" className="nav-oj">
              Online Judge ↗
            </Link>
          </nav>
          <div className="header-actions">
            <HeaderThemeToggle />
            <span className="auth-area">
              {user ? (
                <>
                  <Link to={`/users/${user.username}`} className="auth-profile-link">
                    {user.username}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      window.location.assign('/home');
                    }}
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}>로그인</Link>
                  <Link to="/signup">회원가입</Link>
                </>
              )}
            </span>
            {user && (
              <Link to="/home/notifications" className="notif-bell" title="알림">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="club-container club-main" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <p>&copy; 2026 두루누리. All rights reserved.</p>
      </footer>
    </div>
  );
}
