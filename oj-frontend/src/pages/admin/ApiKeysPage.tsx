import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type { ApiKeyCreated, ApiKeySummary } from '../../api/types';

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justCreated, setJustCreated] = useState<ApiKeyCreated | null>(null);

  function load() {
    api
      .get<ApiKeySummary[]>('/admin/api-keys')
      .then(setKeys)
      .catch(() => setError('API 키 목록을 불러오지 못했습니다.'));
  }

  useEffect(load, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<ApiKeyCreated>('/admin/api-keys', { name });
      setJustCreated(created);
      setName('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'API 키 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm('이 API 키를 폐기할까요? 즉시 사용할 수 없게 됩니다.')) return;
    await api.delete(`/admin/api-keys/${id}`);
    load();
  }

  return (
    <div>
      <p className="text-sm text-fg-muted">
        외부 서비스가 <code className="font-mono text-xs">x-api-key</code> 헤더로 계정 데이터를 조회할 때 쓰는 키입니다
        (<code className="font-mono text-xs">GET /external/v1/users</code>).
      </p>

      <form onSubmit={onCreate} className="mt-4 flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          키 이름
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="partner-service"
            className="rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '생성 중...' : '키 생성'}
        </button>
      </form>

      {error && <p className="mt-2 text-xs text-[var(--color-wa)]">{error}</p>}

      {justCreated && (
        <div className="mt-4 rounded border border-[var(--color-ac)] bg-[var(--color-ac)]/5 p-3">
          <p className="text-xs font-bold text-[var(--color-ac)]">
            키가 생성됐습니다. 이 값은 지금만 보이고 다시 조회할 수 없습니다.
          </p>
          <code className="mt-1 block break-all font-mono text-sm">{justCreated.key}</code>
        </div>
      )}

      {keys && keys.length > 0 && (
        <table className="mt-6 w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-ink-700 text-fg-muted">
              <th className="border border-ink-600 px-2 py-1.5 font-medium">이름</th>
              <th className="border border-ink-600 px-2 py-1.5 font-medium">앞부분</th>
              <th className="border border-ink-600 px-2 py-1.5 font-medium">생성일</th>
              <th className="border border-ink-600 px-2 py-1.5 font-medium">마지막 사용</th>
              <th className="w-20 border border-ink-600 px-2 py-1.5 font-medium">상태</th>
              <th className="w-16 border border-ink-600 px-2 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="border border-ink-600 px-2 py-1.5">{k.name}</td>
                <td className="border border-ink-600 px-2 py-1.5 font-mono text-fg-muted">{k.prefix}…</td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">
                  {new Date(k.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('ko-KR') : '-'}
                </td>
                <td
                  className={`border border-ink-600 px-2 py-1.5 font-bold ${
                    k.revoked ? 'text-[var(--color-wa)]' : 'text-[var(--color-ac)]'
                  }`}
                >
                  {k.revoked ? '폐기됨' : '활성'}
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-center">
                  {!k.revoked && (
                    <button
                      onClick={() => revoke(k.id)}
                      className="text-xs text-[var(--color-wa)] hover:underline"
                    >
                      폐기
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
