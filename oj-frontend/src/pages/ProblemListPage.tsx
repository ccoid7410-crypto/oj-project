import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ProblemSummary } from '../api/types';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { tagColor } from '../lib/tagColor';
import { ProblemTypeBadge } from '../components/ProblemTypeBadge';

export function ProblemListPage() {
  const [problems, setProblems] = useState<ProblemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // 헤더의 "문제" 드롭다운에서 ?scope=PRACTICE로 바로 연습 문제 탭으로 진입할 수 있게
  // URL 쿼리와 동기화한다(탭을 눌러도 URL이 갱신돼 새로고침/공유 시 탭이 유지된다).
  const [searchParams, setSearchParams] = useSearchParams();
  const scope: 'ALL' | 'PRACTICE' = searchParams.get('scope') === 'PRACTICE' ? 'PRACTICE' : 'ALL';
  const setScope = (next: 'ALL' | 'PRACTICE') => {
    setSearchParams(next === 'PRACTICE' ? { scope: 'PRACTICE' } : {});
  };

  useEffect(() => {
    api
      .get<ProblemSummary[]>('/problems')
      .then(setProblems)
      .catch(() => setError('문제 목록을 불러오지 못했습니다.'));
  }, []);

  const filtered = useMemo(() => {
    if (!problems) return null;
    const q = query.trim().toLowerCase();
    const scoped = scope === 'PRACTICE' ? problems.filter((problem) => problem.isPractice) : problems;
    if (!q) return scoped;
    return scoped.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        String(p.displayId).includes(q) ||
        p.problemType.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [problems, query, scope]);

  const solvedCount = problems?.filter((p) => p.myStatus === 'solved').length ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold">문제</h1>
      {problems && (
        <p className="mt-1 text-xs text-fg-muted">
          전체 {problems.length.toLocaleString()}문제 · 내가 푼 문제 {solvedCount.toLocaleString()}문제
        </p>
      )}

      {/* 상단 탭 + 검색 툴바 */}
      <div className="mt-4 flex items-center justify-between border-b border-ink-500">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setScope('ALL')}
            className={`rounded-t border border-b-0 border-ink-500 px-4 py-2 text-sm font-bold ${
              scope === 'ALL' ? 'bg-[var(--color-surface)] text-[var(--color-brand)]' : 'bg-ink-700 text-fg-muted'
            }`}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => setScope('PRACTICE')}
            className={`rounded-t border border-b-0 border-ink-500 px-4 py-2 text-sm font-bold ${
              scope === 'PRACTICE'
                ? 'bg-[var(--color-surface)] text-[var(--color-brand)]'
                : 'bg-ink-700 text-fg-muted'
            }`}
          >
            연습 문제
          </button>
        </div>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="mb-1.5 flex items-center gap-1.5"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="문제 번호, 제목, 태그로 검색"
            className="rounded border border-ink-500 px-[9px] py-1.5 text-sm outline-none focus:border-[var(--color-brand)]"
          />
          <button
            type="button"
            className="shrink-0 rounded bg-[var(--color-brand)] px-4 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)]"
          >
            검색
          </button>
        </form>
      </div>

      {error && <p className="mt-6 text-sm text-[var(--color-wa)]">{error}</p>}

      {problems && problems.length === 0 && (
        <p className="mt-10 text-sm text-fg-muted">
          아직 공개된 문제가 없습니다. 관리자가 문제를 등록/공개하면 여기 표시돼요.
        </p>
      )}

      {filtered && filtered.length > 0 && (
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-ink-700 text-fg-muted">
              <th className="w-16 border border-ink-600 px-2 py-1.5 text-center font-medium">문제</th>
              <th className="border border-ink-600 px-3 py-1.5 font-medium">문제 제목</th>
              <th className="w-20 border border-ink-600 px-2 py-1.5 text-center font-medium">맞힌 사람</th>
              <th className="w-20 border border-ink-600 px-2 py-1.5 text-center font-medium">제출</th>
              <th className="w-20 border border-ink-600 px-2 py-1.5 text-center font-medium">정답 비율</th>
              <th className="w-[120px] border border-ink-600 px-2 py-1.5 font-medium">유형</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-ink-700">
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">{p.displayId}</td>
                <td className="border border-ink-600 px-3 py-1.5">
                  <Link
                    to={`/problems/${p.slug}`}
                    className="flex items-center gap-1.5 text-[var(--color-brand)] hover:underline"
                  >
                    {p.myStatus === 'solved' && (
                      <span className="shrink-0 rounded bg-[var(--color-ac)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        정답
                      </span>
                    )}
                    {p.myStatus === 'attempted' && (
                      <span className="shrink-0 rounded bg-[var(--color-wa)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        오답
                      </span>
                    )}
                    <DifficultyBadge level={p.level} />
                    <ProblemTypeBadge type={p.problemType} isPractice={p.isPractice} />
                    {p.title}
                  </Link>
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">{p.solvedCount}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">{p.submissionCount}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">
                  {p.submissionCount > 0 ? `${p.accuracy}%` : '-'}
                </td>
                <td className="border border-ink-600 px-2 py-1.5">
                  <span className="flex flex-wrap gap-1">
                    {p.tags.map((t) => {
                      const c = tagColor(t);
                      return (
                        <span
                          key={t}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                          data-tag-chip
                          style={{ backgroundColor: c.bg, color: c.fg }}
                        >
                          {t}
                        </span>
                      );
                    })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {filtered && filtered.length === 0 && problems && problems.length > 0 && (
        <p className="mt-10 text-sm text-fg-muted">
          {scope === 'PRACTICE' && !query.trim() ? '공개된 연습 문제가 없습니다.' : '검색 결과가 없습니다.'}
        </p>
      )}
    </div>
  );
}
