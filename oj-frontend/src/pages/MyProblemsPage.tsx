import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { MyProblem, ProblemStatus } from '../api/types';
import { DifficultyBadge } from '../components/DifficultyBadge';

const STATUS_LABEL: Record<ProblemStatus, string> = {
  DRAFT: '초안',
  PENDING_REVIEW: '검토 대기',
  PUBLISHED: '공개됨',
  REJECTED: '반려됨',
};

const STATUS_COLOR: Record<ProblemStatus, string> = {
  DRAFT: 'text-fg-muted',
  PENDING_REVIEW: 'text-[var(--color-brand)]',
  PUBLISHED: 'text-[var(--color-ac)]',
  REJECTED: 'text-[var(--color-wa)]',
};

export function MyProblemsPage() {
  const [problems, setProblems] = useState<MyProblem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    api
      .get<MyProblem[]>('/problems/mine')
      .then(setProblems)
      .catch(() => setError('내 문제 목록을 불러오지 못했습니다.'));
  }

  useEffect(load, []);

  async function submitForReview(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.patch(`/problems/${id}/submit-review`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '검토 요청에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">내가 만든 문제</h1>
        <Link
          to="/problems/new"
          className="rounded bg-[var(--color-brand)] px-3 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)]"
        >
          + 문제 추가
        </Link>
      </div>

      {error && <p className="mt-4 text-sm text-[var(--color-wa)]">{error}</p>}

      {problems && problems.length === 0 && (
        <p className="mt-10 text-sm text-fg-muted">아직 만든 문제가 없습니다.</p>
      )}

      {problems && problems.length > 0 && (
        <table className="mt-4 w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-ink-700 text-fg-muted">
              <th className="w-16 border border-ink-600 px-2 py-1.5 text-center font-medium">번호</th>
              <th className="border border-ink-600 px-3 py-1.5 font-medium">제목</th>
              <th className="w-28 border border-ink-600 px-2 py-1.5 font-medium">상태</th>
              <th className="border border-ink-600 px-3 py-1.5 font-medium">반려 사유</th>
              <th className="w-32 border border-ink-600 px-2 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {problems.map((p) => (
              <tr key={p.id} className="hover:bg-ink-700/60">
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">{p.displayId}</td>
                <td className="border border-ink-600 px-3 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <DifficultyBadge level={p.level} />
                    {p.status === 'PUBLISHED' ? (
                      <Link to={`/problems/${p.slug}`} className="text-[var(--color-brand)] hover:underline">
                        {p.title}
                      </Link>
                    ) : (
                      p.title
                    )}
                  </span>
                </td>
                <td className={`border border-ink-600 px-2 py-1.5 font-bold ${STATUS_COLOR[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </td>
                <td className="border border-ink-600 px-3 py-1.5 text-xs text-fg-muted">{p.reviewNote ?? '-'}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-center">
                  <span className="inline-flex items-center gap-1.5">
                    {/* 초안은 작성 화면에서 이어서 완성·검증까지 하도록 안내한다(검토 요청은 그쪽에서). */}
                    {p.status === 'DRAFT' ? (
                      <Link
                        to={`/problems/new?resume=${encodeURIComponent(p.slug)}`}
                        className="rounded border border-ink-500 px-2 py-1 text-xs hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                      >
                        이어서 작성
                      </Link>
                    ) : (
                      <Link
                        to={`/problems/${p.slug}/edit`}
                        className="rounded border border-ink-500 px-2 py-1 text-xs hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                      >
                        수정
                      </Link>
                    )}
                    {p.status === 'REJECTED' && (
                      <button
                        onClick={() => submitForReview(p.id)}
                        disabled={busyId === p.id}
                        className="rounded border border-ink-500 px-2 py-1 text-xs hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] disabled:opacity-60"
                      >
                        {busyId === p.id ? '요청 중...' : '검토 요청'}
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
