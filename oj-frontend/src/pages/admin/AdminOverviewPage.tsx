import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { AdminOverviewStats } from '../../api/types';
import { useAuth } from '../../context/AuthContext';

function StatCard({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="rounded border border-ink-500 p-4">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${warn ? 'text-[var(--color-wa)]' : ''}`}>{value}</p>
    </div>
  );
}

export function AdminOverviewPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    api.get<AdminOverviewStats>('/admin/stats/overview').then(setStats);
  }, [user?.role]);

  // 선생님은 이 대시보드(전체 현황) 접근 권한이 없다 - 권한이 있는 화면으로 대신 보낸다.
  if (user?.role === 'TEACHER') return <Navigate to="/admin/proposals" replace />;

  if (!stats) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  const queueStuck = stats.judgeHealth.oldestPendingAgeSec > 60;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-sm font-bold text-fg-muted">가입/계정</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="전체 가입자" value={stats.users.total} />
          <StatCard label="부원 가입자" value={stats.users.members} />
          <StatCard label="정지된 계정" value={stats.users.banned} warn={stats.users.banned > 0} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-fg-muted">문제</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="전체 문제" value={stats.problems.total} />
          <StatCard label="공개됨" value={stats.problems.published} />
          <StatCard label="승인 대기" value={stats.problems.pendingReview} warn={stats.problems.pendingReview > 0} />
          <StatCard label="반려됨" value={stats.problems.rejected} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-fg-muted">채점 현황</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="오늘 제출" value={stats.submissions.today} />
          <StatCard label="전체 제출" value={stats.submissions.total} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-fg-muted">
          컴파일 인스턴스(채점 샌드박스) 상태
        </h2>
        <p className="mt-1 text-xs text-fg-muted">
          대기/채점중 제출이 오래 쌓여있으면 judge-worker나 docker 샌드박스가 막혔을 가능성이 큽니다.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="큐에 남은 제출" value={stats.judgeHealth.queueDepth} warn={stats.judgeHealth.queueDepth > 5} />
          <StatCard
            label="가장 오래 대기 중"
            value={queueStuck ? `${stats.judgeHealth.oldestPendingAgeSec}초` : '없음'}
            warn={queueStuck}
          />
          <StatCard
            label="최근 24시간 채점서버 오류"
            value={stats.judgeHealth.internalErrorsLast24h}
            warn={stats.judgeHealth.internalErrorsLast24h > 0}
          />
          <StatCard label="최근 24시간 컴파일 에러" value={stats.judgeHealth.compileErrorsLast24h} />
        </div>
      </section>
    </div>
  );
}
