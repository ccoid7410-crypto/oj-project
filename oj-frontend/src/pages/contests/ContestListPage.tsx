import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { ContestSummary } from '../../api/types';

const PHASE_LABEL: Record<ContestSummary['phase'], string> = {
  UPCOMING: '예정',
  RUNNING: '진행 중',
  ENDED: '종료',
};

const PHASE_COLOR: Record<ContestSummary['phase'], string> = {
  UPCOMING: 'text-[var(--color-brand)]',
  RUNNING: 'text-[var(--color-ac)]',
  ENDED: 'text-fg-muted',
};

export function ContestListPage() {
  const [contests, setContests] = useState<ContestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ContestSummary[]>('/contests')
      .then(setContests)
      .catch(() => setError('대회 목록을 불러오지 못했습니다.'));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">대회</h1>

      {error && <p className="mt-6 text-sm text-[var(--color-wa)]">{error}</p>}

      {contests && contests.length === 0 && (
        <p className="mt-10 text-sm text-fg-muted">아직 등록된 대회가 없습니다.</p>
      )}

      {contests && contests.length > 0 && (
        <table className="mt-4 w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-ink-700 text-fg-muted">
              <th className="w-24 border border-ink-600 px-2 py-1.5 font-medium">상태</th>
              <th className="border border-ink-600 px-3 py-1.5 font-medium">대회명</th>
              <th className="w-40 border border-ink-600 px-2 py-1.5 font-medium">시작</th>
              <th className="w-40 border border-ink-600 px-2 py-1.5 font-medium">종료</th>
              <th className="w-20 border border-ink-600 px-2 py-1.5 text-center font-medium">문제 수</th>
              <th className="w-20 border border-ink-600 px-2 py-1.5 text-center font-medium">참가자</th>
            </tr>
          </thead>
          <tbody>
            {contests.map((c) => (
              <tr key={c.id} className="hover:bg-ink-700/60">
                <td className={`border border-ink-600 px-2 py-1.5 font-bold ${PHASE_COLOR[c.phase]}`}>
                  {PHASE_LABEL[c.phase]}
                </td>
                <td className="border border-ink-600 px-3 py-1.5">
                  <Link to={`/contests/${c.slug}`} className="text-[var(--color-brand)] hover:underline">
                    {c.title}
                  </Link>
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">
                  {new Date(c.startsAt).toLocaleString('ko-KR')}
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">
                  {new Date(c.endsAt).toLocaleString('ko-KR')}
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">{c.problemCount}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">
                  {c.participantCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
