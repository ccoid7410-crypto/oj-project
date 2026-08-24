import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { ServerInfo } from '../../api/types';

/** 배포 탭에서 분리한 서버 정보 화면. LAN IP + 서버/배포 에이전트 상태를 보여준다. */
export function ServerInfoPage() {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api
        .get<ServerInfo>('/admin/deploy/server-info')
        .then(setInfo)
        .catch(() => setError('서버 정보를 불러오지 못했습니다.'));
    load();
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, []);

  if (error) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!info) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  const uptime = formatUptime(info.uptimeSec);

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-lg font-bold">서버 정보</h2>
      <dl className="mt-3 divide-y divide-ink-500 rounded border border-ink-500 text-sm">
        <Row label="내부(LAN) IP" value={<span className="font-mono">{info.lanIp ?? '알 수 없음'}</span>} />
        <Row
          label="서버 상태"
          value={<Badge ok label="정상 동작 중" />}
        />
        <Row
          label="배포 에이전트"
          value={
            !info.agentConfigured ? (
              <span className="text-fg-muted">설정 안 됨</span>
            ) : info.agentOnline ? (
              <Badge ok label="연결됨" />
            ) : (
              <Badge ok={false} label="응답 없음" />
            )
          }
        />
        <Row label="가동 시간" value={uptime} />
        <Row label="Node 버전" value={<span className="font-mono">{info.nodeVersion}</span>} />
        <Row label="서버 시각" value={new Date(info.serverTime).toLocaleString('ko-KR')} />
      </dl>
      <p className="mt-2 text-xs text-fg-muted">10초마다 자동으로 새로고침됩니다.</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-medium text-fg">{value}</dd>
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${ok ? 'text-[var(--color-ac)]' : 'text-[var(--color-wa)]'}`}>
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-[var(--color-ac)]' : 'bg-[var(--color-wa)]'}`} />
      {label}
    </span>
  );
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}일`);
  if (h) parts.push(`${h}시간`);
  parts.push(`${m}분`);
  return parts.join(' ');
}
