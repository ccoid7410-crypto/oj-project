import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ADMIN_TABS = [
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
  { to: '/admin/mail', label: '메일 설정' },
  { to: '/admin/banner', label: '배너 설정' },
  { to: '/admin/api-keys', label: 'API 키' },
  { to: '/admin/notifications', label: '알림' },
];

// 선생님은 부분 권한만 있다: 수업 관리 + 문제 검수/승인 + 학생 계정 관리(정지/해제). 그 외
// 관리자 전용 화면(채점/메일/배너 설정, API 키, 대량 계정 생성 등)은 탭 자체를 안 보여준다 -
// 백엔드도 어차피 막지만, 눌러서 403을 보는 것보다 애초에 안 보이는 게 낫다.
const TEACHER_TABS = [
  { to: '/admin/proposals', label: '제안 검토' },
  { to: '/admin/classes', label: '수업 관리' },
  { to: '/admin/accounts', label: '계정 관리' },
];

export function AdminLayout() {
  const { user } = useAuth();
  const isTeacherOnly = user?.role === 'TEACHER';
  const TABS = isTeacherOnly ? TEACHER_TABS : ADMIN_TABS;

  return (
    <div>
      <h1 className="text-2xl font-bold">{isTeacherOnly ? '선생님 관리' : '관리자'}</h1>
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
