import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBrandName } from '../lib/useBrandName';
import { api } from '../api/client';
import { Avatar } from './Avatar';
import { UserTitleBadge } from './UserTitleBadge';
import { MegaMenuTrigger, type MegaMenu } from './HeaderDropdown';
import { HeaderThemeToggle } from './HeaderThemeToggle';

// 마우스가 트리거에서 패널로 넘어가는 짧은 순간 깜빡이며 닫히는 걸 막기 위한 유예 시간.
const CLOSE_DELAY_MS = 120;

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const brandName = useBrandName();
  const [unreadCount, setUnreadCount] = useState(0);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 백준 특유의 밑줄 없는 상단바 안에서 쓰는 링크 스타일.
  // 밑줄 대신 hover 시 글자색만 밝아진다.
  const navLinkClass =
    'shrink-0 py-3 text-[13px] font-medium text-[var(--color-header-fg)] hover:text-[var(--color-header-fg-hover)]';

  // 하위 항목이 2개 이상인 메뉴만 메가패널이 열린다(1개짜리는 트리거 자체가 그 링크).
  // "내 문제"는 예전엔 별도 최상위 링크였는데, "문제" 메뉴 하나로 모으는 게 자연스러워 여기로 옮겼다.
  const megaMenus: MegaMenu[] = [
    {
      key: 'problems',
      label: '문제',
      items: [
        { to: '/problems', label: '전체 문제' },
        { to: '/problems?scope=PRACTICE', label: '연습 문제' },
        ...(user ? [{ to: '/problems/mine', label: '내 문제' }] : []),
      ],
    },
    { key: 'contests', label: '대회', items: [{ to: '/contests', label: '대회' }] },
    ...(user
      ? [
          {
            key: 'submissions',
            label: '채점 현황',
            items: [
              { to: '/submissions', label: '전체 제출' },
              { to: '/submissions/me', label: '내 제출' },
            ],
          },
        ]
      : []),
    { key: 'ranking', label: '랭킹', items: [{ to: '/ranking', label: '랭킹' }] },
    ...(user ? [{ key: 'classes', label: '수업', items: [{ to: '/classes', label: '수업' }] }] : []),
    { key: 'community', label: '커뮤니티', items: [{ to: '/community', label: '커뮤니티' }] },
  ];
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenMenu(null), CLOSE_DELAY_MS);
  };

  return (
    <div className="min-h-screen bg-[var(--color-page-bg)]">
      <header
        className="relative bg-[var(--color-header-bg)] border-b border-[var(--color-header-line)]"
        onMouseLeave={scheduleClose}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-stretch gap-x-7 gap-y-1 px-6">
          <Link to="/" className="flex items-baseline gap-1 py-3 leading-none">
            <span className="text-base font-black tracking-tight text-fg">{brandName}</span>
            <span className="text-[var(--color-brand)]">&gt;</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-5">
            {megaMenus.map((menu) => (
              <MegaMenuTrigger
                key={menu.key}
                menu={menu}
                className={navLinkClass}
                isOpen={openMenu === menu.key}
                onOpen={setOpenMenu}
                onClose={() => setOpenMenu(null)}
                onCancelClose={cancelClose}
                onScheduleClose={scheduleClose}
              />
            ))}
            {user?.role === 'ADMIN' && (
              <Link to="/admin" className={navLinkClass}>
                관리자
              </Link>
            )}
            {user?.role === 'ADMIN' && (
              <Link to="/admin/notifications" className={`relative ${navLinkClass}`}>
                알림
                {unreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-[var(--color-wa)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
            )}
            {/* 동아리 홈페이지로 이동. React 밖의 정적 사이트라 Link 대신 일반 앵커를 쓴다. */}
            <a href="/home/" className={navLinkClass}>
              Durunuri ↗
            </a>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3 py-3 text-[12px] text-[var(--color-header-fg)]">
            <HeaderThemeToggle />
            {user ? (
              <>
                <Link
                  to={`/users/${user.username}`}
                  className="flex items-center gap-1.5 hover:text-[var(--color-header-fg-hover)]"
                >
                  <Avatar username={user.username} avatarVersion={user.avatarVersion ?? null} size={18} />
                  <UserTitleBadge title={user.customTitle} />
                  {user.username}
                </Link>
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="hover:text-[var(--color-header-fg-hover)]"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link
                  // 로그인 후 지금 보던 페이지로 돌아올 수 있게 현재 위치를 redirect로 넘긴다
                  to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
                  className="hover:text-[var(--color-header-fg-hover)]"
                >
                  로그인
                </Link>
                <Link to="/signup" className="hover:text-[var(--color-header-fg-hover)]">
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl border-x border-ink-600 bg-[var(--color-surface)] px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
