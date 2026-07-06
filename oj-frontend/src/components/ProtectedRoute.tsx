import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="text-sm text-fg-muted">불러오는 중...</p>;
  if (!user) {
    // 로그인 후 원래 가려던 페이지로 돌아올 수 있게 현재 위치를 redirect로 넘긴다
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return <Outlet />;
}
