import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { ProblemProposal } from '../../api/types';
import { DifficultyBadge } from '../../components/DifficultyBadge';

export function ProposalsPage() {
  const [proposals, setProposals] = useState<ProblemProposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  function load() {
    api
      .get<ProblemProposal[]>('/problems/proposals')
      .then(setProposals)
      .catch(() => setError('제안 목록을 불러오지 못했습니다.'));
  }

  useEffect(load, []);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.patch(`/problems/${id}/approve`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '승인에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.patch(`/problems/${id}/reject`, { note: rejectNote[id] ?? '' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '반려에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  if (error && !proposals) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!proposals) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  return (
    <div>
      <p className="text-sm text-fg-muted">일반 사용자가 제안한 문제 중 검토 대기 중인 것들입니다.</p>

      {error && <p className="mt-2 text-xs text-[var(--color-wa)]">{error}</p>}

      {proposals.length === 0 && <p className="mt-8 text-sm text-fg-muted">검토 대기 중인 제안이 없습니다.</p>}

      <div className="mt-4 flex flex-col gap-3">
        {proposals.map((p) => (
          <div key={p.id} className="rounded border border-ink-500 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="text-xs text-fg-muted">{p.displayId}번</span>
                <DifficultyBadge level={p.level} />
                <Link to={`/problems/${p.slug}`} className="font-bold text-[var(--color-brand)] hover:underline">
                  {p.title}
                </Link>
              </span>
              <span className="text-xs text-fg-muted">
                제안자 {p.author.username} · {new Date(p.createdAt).toLocaleString('ko-KR')}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => approve(p.id)}
                disabled={busyId === p.id}
                className="rounded bg-[var(--color-ac)] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
              >
                승인 · 공개
              </button>
              <input
                value={rejectNote[p.id] ?? ''}
                onChange={(e) => setRejectNote((prev) => ({ ...prev, [p.id]: e.target.value }))}
                placeholder="반려 사유 (선택)"
                className="flex-1 rounded border border-ink-500 px-2 py-1.5 text-xs outline-none focus:border-[var(--color-brand)]"
              />
              <button
                onClick={() => reject(p.id)}
                disabled={busyId === p.id}
                className="rounded border border-[var(--color-wa)] px-3 py-1.5 text-xs font-bold text-[var(--color-wa)] hover:bg-[var(--color-wa)]/10 disabled:opacity-60"
              >
                반려
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
