import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type { DeployResult, ServerInfo } from '../../api/types';

export function DeployPage() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<ServerInfo>('/admin/deploy/server-info').then(setServerInfo).catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (
      !window.confirm(
        '지금 서버에서 git pull + docker compose build/up을 실행합니다.\n' +
          '되돌리기 어려운 작업입니다. 계속할까요?',
      )
    )
      return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<DeployResult>('/admin/deploy', { password });
      setResult(res);
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '배포 요청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-lg font-bold">서버 정보</h2>
      <div className="mt-2 rounded border border-ink-500 p-3 text-sm">
        <p className="text-fg-muted">내부(LAN) IP</p>
        <p className="mt-1 font-mono text-base">{serverInfo?.lanIp ?? '알 수 없음'}</p>
      </div>

      <h2 className="mt-8 text-lg font-bold">배포</h2>
      <p className="mt-1 text-sm text-fg-muted">
        최신 커밋을 받아(git pull) 이미지를 다시 빌드하고 컨테이너를 재기동합니다. 비밀번호로 본인 확인 후 진행됩니다.
      </p>
      <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-48 rounded border border-ink-500 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-brand)]"
        />
        <button
          type="submit"
          disabled={submitting || !password}
          className="rounded bg-[var(--color-brand)] px-3 py-1.5 text-sm font-bold text-white hover:opacity-85 disabled:opacity-60"
        >
          {submitting ? '배포 중... (몇 분 걸릴 수 있음)' : '지금 배포'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-[var(--color-wa)]">{error}</p>}

      {result && (
        <div className="mt-4">
          <p className={`text-sm font-bold ${result.ok ? 'text-[var(--color-ac)]' : 'text-[var(--color-wa)]'}`}>
            {result.ok ? '배포 성공' : '배포 실패'}
          </p>
          <ul className="mt-2 space-y-2">
            {result.steps.map((s, i) => (
              <li key={i} className="rounded border border-ink-500 p-2 text-xs">
                <p className={`font-bold ${s.ok ? 'text-[var(--color-ac)]' : 'text-[var(--color-wa)]'}`}>
                  {s.ok ? '✓' : '✗'} {s.step}
                </p>
                <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                  {s.output}
                </pre>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
