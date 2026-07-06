import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type { BulkCreateResult } from '../../api/types';

export function BulkUsersPage() {
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState('user');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkCreateResult | null>(null);

  const inputClass =
    'rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<BulkCreateResult>('/admin/users/bulk', { count, prefix });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '계정 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  function downloadCsv() {
    if (!result) return;
    const header = 'username,email,password,role\n';
    const body = result.created.map((u) => `${u.username},${u.email},${u.password},${u.role}`).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-users-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <p className="text-sm text-fg-muted">
        접두어 + 일련번호 형태로 계정을 한 번에 만듭니다 (예: team001, team002, ...). 최대 100개. 관리자 토큰이
        탈취됐을 때 피해를 줄이기 위해 이 경로로는 항상 USER 권한으로만 생성되고, 최초 로그인 시 비밀번호 변경이
        강제됩니다.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          개수
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className={`${inputClass} w-24`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          접두어
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className={`${inputClass} w-32`} />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '생성 중...' : '생성'}
        </button>
      </form>

      {error && <p className="mt-3 text-xs text-[var(--color-wa)]">{error}</p>}

      {result && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              생성 {result.createdCount}개 · 건너뜀 {result.skippedCount}개
            </p>
            {result.created.length > 0 && (
              <button
                onClick={downloadCsv}
                className="rounded border border-ink-500 px-3 py-1 text-xs hover:border-[var(--color-brand)]"
              >
                CSV 다운로드
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--color-wa)]">
            비밀번호는 지금만 표시됩니다. 다시 조회할 수 없으니 지금 저장하세요.
          </p>

          {result.created.length > 0 && (
            <table className="mt-3 w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="bg-ink-700 text-fg-muted">
                  <th className="border border-ink-600 px-2 py-1.5 font-medium">username</th>
                  <th className="border border-ink-600 px-2 py-1.5 font-medium">email</th>
                  <th className="border border-ink-600 px-2 py-1.5 font-medium">password</th>
                  <th className="border border-ink-600 px-2 py-1.5 font-medium">role</th>
                </tr>
              </thead>
              <tbody>
                {result.created.map((u) => (
                  <tr key={u.username}>
                    <td className="border border-ink-600 px-2 py-1.5 font-mono">{u.username}</td>
                    <td className="border border-ink-600 px-2 py-1.5 font-mono text-fg-muted">{u.email}</td>
                    <td className="border border-ink-600 px-2 py-1.5 font-mono">{u.password}</td>
                    <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {result.skipped.length > 0 && (
            <p className="mt-3 text-xs text-fg-muted">
              건너뜀: {result.skipped.map((s) => `${s.username}(${s.reason})`).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
