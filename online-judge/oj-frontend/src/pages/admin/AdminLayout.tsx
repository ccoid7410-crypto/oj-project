import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/admin', label: '전체 현황' },
  { to: '/admin/problems', label: '문제 관리' },
  { to: '/admin/problems/new', label: '문제 추가' },
  { to: '/admin/proposals', label: '제안 검토' },
  { to: '/admin/contests', label: '대회 관리' },
  { to: '/admin/classes', label: '수업 관리' },
  { to: '/admin/groups', label: '그룹 관리' },
  { to: '/admin/accounts', label: '계정 관리' },
  { to: '/admin/student-id', label: '학번 관리' },
  { to: '/admin/users/bulk', label: '대량 계정 생성' },
  { to: '/admin/judge-config', label: '채점 설정' },
  { to: '/admin/api-keys', label: 'API 키' },
  { to: '/admin/notifications', label: '알림' },
];

export function AdminLayout() {
  return (
    <div>
      <h1 className="text-2xl font-bold">관리자</h1>
      <nav className="mt-4 flex gap-1 border-b border-ink-500">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/admin'}
            className={({ isActive }) =>
              `border-b-2 px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                  : 'border-transparent text-fg-muted hover:text-fg'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
