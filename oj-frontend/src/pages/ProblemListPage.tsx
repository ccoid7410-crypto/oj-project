import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { ProblemSummary } from '../api/types';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { tagColor } from '../lib/tagColor';

export function ProblemListPage() {
  const [problems, setProblems] = useState<ProblemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .get<ProblemSummary[]>('/problems')
      .then(setProblems)
      .catch(() => setError('문제 목록을 불러오지 못했습니다.'));
  }, []);

  const filtered = useMemo(() => {
    if (!problems) return null;
    const q = query.trim().toLowerCase();
    if (!q) return problems;
    return problems.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        String(p.displayId).includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [problems, query]);

  return (
    <div>
      {/* 상단 탭 + 검색 툴바 */}
      <div className="flex items-center justify-between border-b border-ink-500">
        <div className="flex gap-1">
          <span className="rounded-t border border-b-0 border-ink-500 bg-white px-4 py-2 text-sm font-bold text-[var(--color-brand)]">
            전체
          </span>
        </div>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="mb-1.5 flex items-center overflow-hidden rounded border border-ink-500"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="문제 번호, 제목, 태그로 검색"
            className="w-56 px-3 py-1.5 text-sm outline-none"
          />
          <span className="border-l border-ink-500 bg-[var(--color-brand)] px-3 py-1.5 text-white">🔍</span>
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
              <th className="w-40 border border-ink-600 px-2 py-1.5 font-medium">정보</th>
              <th className="w-24 border border-ink-600 px-2 py-1.5 text-center font-medium">맞힌 사람</th>
              <th className="w-20 border border-ink-600 px-2 py-1.5 text-center font-medium">제출</th>
              <th className="w-24 border border-ink-600 px-2 py-1.5 text-center font-medium">정답 비율</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-ink-700/60">
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">{p.displayId}</td>
                <td className="border border-ink-600 px-3 py-1.5">
                  <Link
                    to={`/problems/${p.slug}`}
                    className="flex items-center gap-1.5 text-[var(--color-brand)] hover:underline"
                  >
                    <DifficultyBadge level={p.level} />
                    {p.title}
                  </Link>
                </td>
                <td className="border border-ink-600 px-2 py-1.5">
                  <span className="flex flex-wrap gap-1">
                    {p.tags.slice(0, 3).map((t) => {
                      const c = tagColor(t);
                      return (
                        <span
                          key={t}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: c.bg, color: c.fg }}
                        >
                          {t}
                        </span>
                      );
                    })}
                  </span>
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">{p.solvedCount}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">{p.submissionCount}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">
                  {p.submissionCount > 0 ? `${p.accuracy}%` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {filtered && filtered.length === 0 && problems && problems.length > 0 && (
        <p className="mt-10 text-sm text-fg-muted">검색 결과가 없습니다.</p>
      )}
    </div>
  );
}
