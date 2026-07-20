import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function AdminRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-sm text-fg-muted">불러오는 중...</p>;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'TEACHER')) return <Navigate to="/" replace />;
  return <Outlet />;
}
