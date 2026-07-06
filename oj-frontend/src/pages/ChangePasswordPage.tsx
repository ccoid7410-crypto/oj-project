import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function ChangePasswordPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/users/me/change-password', { currentPassword, newPassword });
      await refreshUser();
      navigate('/problems');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '비밀번호 변경에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded border border-ink-500 bg-white p-6">
      <h1 className="text-2xl font-bold">비밀번호 변경</h1>
      {user?.mustChangePassword && (
        <p className="mt-2 text-xs text-[var(--color-wa)]">
          관리자가 만들어준 임시 비밀번호를 그대로 쓰고 있어요. 계속 이용하려면 비밀번호를 바꿔야 합니다.
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          현재 비밀번호
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          새 비밀번호 (8자 이상)
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-[var(--color-brand)] py-2 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  );
}
