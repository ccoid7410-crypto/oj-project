import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';

export function ResendVerificationPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.post<{ message: string }>('/auth/resend-verification', { email });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '요청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded border border-ink-500 bg-white p-6">
      <h1 className="text-2xl font-bold">인증 메일 다시 받기</h1>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          이메일
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        {message && <p className="text-xs text-[var(--color-ac)]">{message}</p>}
        {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-[var(--color-brand)] py-2 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '요청 중...' : '다시 보내기'}
        </button>
      </form>
    </div>
  );
}
