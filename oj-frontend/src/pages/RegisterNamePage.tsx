import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function RegisterNamePage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.patch('/users/me/name', { name });
      await refreshUser();
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '이름 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded border border-ink-500 bg-white p-6">
      <h1 className="text-2xl font-bold">이름 등록</h1>
      {!user?.name && (
        <p className="mt-2 text-xs text-[var(--color-wa)]">
          계정에 이름(실명)이 등록되어 있지 않아요. 계속 이용하려면 이름을 등록해야 합니다.
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          이름 (실명)
          <input
            required
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 김철수"
            className="rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="mt-2 rounded bg-[var(--color-brand)] py-2 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '등록 중...' : '등록'}
        </button>
      </form>
    </div>
  );
}
