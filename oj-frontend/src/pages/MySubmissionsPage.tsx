import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { MySubmission } from '../api/types';
import { VerdictBadge } from '../components/VerdictBadge';

/** 점수는 소수점이 길게 붙을 수 있어 꼬리 0을 정리해서 보여준다. */
function formatScore(sub: MySubmission): string {
  if (sub.score == null) return '-';
  const value = sub.score.toFixed(4).replace(/\.?0+$/, '');
  const max = sub.problem?.maxScore;
  return max != null ? `${value} / ${max}` : value;
}

/**
 * 내가 낸 제출만 모아 보는 페이지.
 *
 * 전체 채점 현황 피드(/submissions)와 달리 공개되지 않은 내 문제나 대회 전용 문제에 낸
 * 제출도 여기서는 보인다. 소스코드/테스트 결과는 각 행을 눌러 상세로 들어가면 볼 수 있다.
 */
export function MySubmissionsPage() {
  const [submissions, setSubmissions] = useState<MySubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<MySubmission[]>('/submissions/me?limit=200')
      .then(setSubmissions)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : '제출 내역을 불러오지 못했습니다.'),
      );
  }, []);

  if (error) return <p className="mt-6 text-sm text-[var(--color-wa)]">{error}</p>;
  if (!submissions) return <p className="mt-6 text-sm text-fg-muted">불러오는 중...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">내 제출</h1>
      <p className="mt-1 text-xs text-fg-muted">
        내가 낸 제출 내역입니다. 결과를 누르면 소스코드와 테스트케이스별 결과를 볼 수 있습니다.
      </p>

      {submissions.length === 0 && (
        <p className="mt-10 text-sm text-fg-muted">아직 제출한 기록이 없습니다.</p>
      )}

      {submissions.length > 0 && (
        <table className="mt-4 w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-ink-700 text-fg-muted">
              <th className="border border-ink-600 px-2 py-1.5 font-medium">결과</th>
              <th className="border border-ink-600 px-3 py-1.5 font-medium">문제</th>
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
                    <span className="flex items-center gap-1.5">
                      <Link
                        to={`/problems/${s.problem.slug}`}
                        className="hover:text-[var(--color-brand)]"
                      >
                        {s.problem.displayId}. {s.problem.title}
                      </Link>
                      {s.problem.isPractice && (
                        <span className="rounded bg-ink-600 px-1.5 py-0.5 text-[10px] text-fg-muted">
                          연습
                        </span>
                      )}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{s.memoryKb != null ? `${s.memoryKb}KB` : '-'}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{s.runtimeMs != null ? `${s.runtimeMs}ms` : '-'}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{formatScore(s)}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{s.language}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">
                  {new Date(s.createdAt).toLocaleString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
