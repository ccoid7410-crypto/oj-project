import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { ContestDetail } from '../../api/types';
import { DifficultyBadge } from '../../components/DifficultyBadge';
import { useAuth } from '../../context/AuthContext';

const PHASE_LABEL = { UPCOMING: '예정', RUNNING: '진행 중', ENDED: '종료' } as const;

export function ContestDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  function load() {
    if (!slug) return;
    api
      .get<ContestDetail>(`/contests/${slug}`)
      .then(setContest)
      .catch(() => setError('대회를 찾을 수 없습니다.'));
  }

  useEffect(load, [slug]);

  async function onRegister() {
    if (!contest) return;
    setRegistering(true);
    setError(null);
    try {
      await api.post(`/contests/${contest.id}/register`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '참가 등록에 실패했습니다.');
    } finally {
      setRegistering(false);
    }
  }

  if (error && !contest) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!contest) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{contest.title}</h1>
        <Link
          to={`/contests/${contest.slug}/leaderboard`}
          className="rounded border border-ink-500 px-3 py-1.5 text-sm hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
        >
          순위표
        </Link>
      </div>
      <p className="mt-1 text-xs text-fg-muted">
        {PHASE_LABEL[contest.phase]} · {new Date(contest.startsAt).toLocaleString('ko-KR')} ~{' '}
        {new Date(contest.endsAt).toLocaleString('ko-KR')} · 주최 {contest.createdBy} · 참가자{' '}
        {contest.participantCount}명
      </p>

      {contest.description && (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{contest.description}</p>
      )}

      {user && contest.phase !== 'ENDED' && (
        <div className="mt-4">
          {contest.registered ? (
            <span className="text-sm font-bold text-[var(--color-ac)]">참가 신청 완료</span>
          ) : (
            <button
              onClick={onRegister}
              disabled={registering}
              className="rounded bg-[var(--color-brand)] px-4 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
            >
              {registering ? '신청 중...' : '참가 신청'}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-[var(--color-wa)]">{error}</p>}

      <h2 className="mt-8 border-b border-ink-500 pb-1 text-base font-bold">문제</h2>
      {contest.phase === 'UPCOMING' && (
        <p className="mt-3 text-sm text-fg-muted">대회가 시작되면 문제 목록이 공개됩니다.</p>
      )}
      {contest.phase !== 'UPCOMING' && contest.problems.length > 0 && (
        <table className="mt-3 w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-ink-700 text-fg-muted">
              <th className="w-16 border border-ink-600 px-2 py-1.5 text-center font-medium">번호</th>
              <th className="border border-ink-600 px-3 py-1.5 font-medium">제목</th>
              <th className="w-20 border border-ink-600 px-2 py-1.5 text-center font-medium">배점</th>
            </tr>
          </thead>
          <tbody>
            {contest.problems.map((p) => (
              <tr key={p.problemId} className="hover:bg-ink-700/60">
                <td className="border border-ink-600 px-2 py-1.5 text-center font-bold">{p.label}</td>
                <td className="border border-ink-600 px-3 py-1.5">
                  <Link
                    to={`/problems/${p.slug}?contestId=${contest.id}`}
                    className="flex items-center gap-1.5 text-[var(--color-brand)] hover:underline"
                  >
                    <DifficultyBadge level={p.level} />
                    {p.title}
                  </Link>
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">{p.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
