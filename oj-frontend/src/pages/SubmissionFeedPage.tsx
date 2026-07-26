import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { SubmissionSummary } from '../api/types';
import { VerdictBadge } from '../components/VerdictBadge';

export function SubmissionFeedPage() {
  const [submissions, setSubmissions] = useState<SubmissionSummary[] | null>(null);

  useEffect(() => {
    api.get<SubmissionSummary[]>('/submissions?limit=100').then(setSubmissions);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">채점 현황</h1>
      <p className="mt-1 text-xs text-fg-muted">전체 사용자의 최근 제출 100건. 소스코드는 본인/관리자만 볼 수 있습니다.</p>

      {submissions && submissions.length === 0 && (
        <p className="mt-10 text-sm text-fg-muted">아직 제출된 기록이 없습니다.</p>
      )}

      {submissions && submissions.length > 0 && (
        <table className="mt-4 w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-ink-700 text-fg-muted">
              <th className="border border-ink-600 px-2 py-1.5 font-medium">결과</th>
              <th className="border border-ink-600 px-3 py-1.5 font-medium">문제</th>
              <th className="border border-ink-600 px-2 py-1.5 font-medium">제출자</th>
              <th className="border border-ink-600 px-2 py-1.5 font-medium">메모리</th>
              <th className="border border-ink-600 px-2 py-1.5 font-medium">시간</th>
              <th className="border border-ink-600 px-2 py-1.5 font-medium">점수</th>
              <th className="border border-ink-600 px-2 py-1.5 font-medium">언어</th>
              <th className="border border-ink-600 px-2 py-1.5 font-medium">제출한 시간</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} className="hover:bg-ink-700/60">
                <td className="border border-ink-600 px-2 py-1.5">
                  <Link to={`/submissions/${s.id}`}>
                    <VerdictBadge status={s.status} showPulse={false} />
                  </Link>
                </td>
                <td className="border border-ink-600 px-3 py-1.5 text-fg-muted">
                  {s.problem ? (
                    <Link to={`/problems/${s.problem.slug}`} className="hover:text-[var(--color-brand)]">
                      {s.problem.title}
                    </Link>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">
                  {s.user ? (
                    <Link to={`/users/${s.user.username}`} className="hover:text-[var(--color-brand)]">
                      {s.user.username}
                    </Link>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{s.memoryKb != null ? `${s.memoryKb}KB` : '-'}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{s.runtimeMs != null ? `${s.runtimeMs}ms` : '-'}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">
                  {s.score != null ? s.score.toFixed(4).replace(/\.?0+$/, '') : '-'}
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{s.language}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{new Date(s.createdAt).toLocaleString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
