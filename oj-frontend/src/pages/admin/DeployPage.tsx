import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type { DeployStatus } from '../../api/types';

const POLL_INTERVAL_MS = 3000;

export function DeployPage() {
  const [password, setPassword] = useState('');
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState<DeployStatus | null>(null);
  // 배포 마지막 단계에서 api 컨테이너도 재시작돼 조회가 잠깐 실패한다. 그건 오류가 아니다.
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const next = await api.get<DeployStatus>('/admin/deploy/status');
      setStatus(next);
      setReconnecting(false);
      if (next.running) timer.current = setTimeout(poll, POLL_INTERVAL_MS);
    } catch {
      // 서버가 다시 뜨는 중일 수 있으니 계속 물어본다.
      setReconnecting(true);
      timer.current = setTimeout(poll, POLL_INTERVAL_MS);
    }
  }, []);

  useEffect(() => {
    // 눌러놓고 화면을 나갔다 들어와도 진행 중인 배포를 이어서 보여준다.
    void poll();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (
      !window.confirm(
        '지금 서버에서 git pull + docker compose build/up을 실행합니다.\n' +
          '되돌리기 어려운 작업입니다. 계속할까요?',
      )
    )
      return;
    setStarting(true);
    setError(null);
    try {
      const res = await api.post<{ started: boolean }>('/admin/deploy', { password });
      setPassword('');
      if (!res.started) setError('이미 배포가 진행 중입니다.');
      void poll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '배포 요청에 실패했습니다.');
    } finally {
      setStarting(false);
    }
  }

  const running = status?.running ?? false;

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-lg font-bold">배포</h2>
      <p className="mt-1 text-sm text-fg-muted">
        최신 커밋을 받아(git pull) 이미지를 다시 빌드하고 컨테이너를 재기동합니다. 비밀번호로 본인
        확인 후 진행됩니다. 마지막 단계에서 서버가 잠깐 재시작되니, 화면이 끊겨도 기다리면 결과가
        나옵니다.
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
          disabled={starting || running || !password}
          className="rounded bg-[var(--color-brand)] px-3 py-1.5 text-sm font-bold text-white hover:opacity-85 disabled:opacity-60"
        >
          {running ? '배포 중... (몇 분 걸릴 수 있음)' : '지금 배포'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-[var(--color-wa)]">{error}</p>}
      {reconnecting && (
        <p className="mt-2 text-sm text-fg-muted">서버가 다시 뜨는 중입니다. 기다려주세요...</p>
      )}

      {status && status.steps.length > 0 && (
        <div className="mt-4">
          <p
            className={`text-sm font-bold ${
              status.running
                ? 'text-fg-muted'
                : status.ok
                  ? 'text-[var(--color-ac)]'
                  : 'text-[var(--color-wa)]'
            }`}
          >
            {status.running ? '진행 중' : status.ok ? '배포 성공' : '배포 실패'}
            {status.finishedAt && (
              <span className="ml-2 font-normal text-fg-muted">
                {new Date(status.finishedAt).toLocaleString('ko-KR')}
              </span>
            )}
          </p>
          <ul className="mt-2 space-y-2">
            {status.steps.map((s, i) => (
              <li key={i} className="rounded border border-ink-500 p-2 text-xs">
                <p
                  className={`font-bold ${s.ok ? 'text-[var(--color-ac)]' : 'text-[var(--color-wa)]'}`}
                >
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
