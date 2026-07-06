import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { AdminProblemRow } from '../../api/types';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안',
  PENDING_REVIEW: '승인 대기',
  PUBLISHED: '공개됨',
  REJECTED: '반려됨',
};

export function AdminProblemsPage() {
  const [problems, setProblems] = useState<AdminProblemRow[] | null>(null);
  const [query, setQuery] = useState('');

  function load() {
    api.get<AdminProblemRow[]>('/admin/problems').then(setProblems);
  }

  useEffect(load, []);

  async function onDelete(p: AdminProblemRow) {
    if (!confirm(`"${p.title}" 문제를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await api.delete(`/problems/${p.id}`);
    load();
  }

  const filtered = (problems ?? []).filter(
    (p) => !query || p.title.toLowerCase().includes(query.toLowerCase()) || p.author.username.includes(query),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">문제 관리</h1>
      <p className="mt-1 text-xs text-fg-muted">상태와 무관하게 전체 문제를 보고 삭제할 수 있습니다.</p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="제목/작성자 검색"
        className="mt-4 w-full max-w-sm rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
      />

      {problems && (
        <table className="mt-4 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink-500 text-xs text-fg-muted">
              <th className="py-2 font-medium">번호</th>
              <th className="py-2 font-medium">제목</th>
              <th className="py-2 font-medium">작성자</th>
              <th className="py-2 font-medium">상태</th>
              <th className="py-2 font-medium">대회 전용</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-ink-600">
                <td className="py-2 text-fg-muted">{p.displayId}</td>
                <td className="py-2">
                  <Link to={`/problems/${p.slug}`} className="hover:text-[var(--color-brand)]">
                    {p.title}
                  </Link>
                </td>
                <td className="py-2 text-fg-muted">{p.author.username}</td>
                <td className="py-2 text-fg-muted">{STATUS_LABEL[p.status] ?? p.status}</td>
                <td className="py-2 text-fg-muted">{p.contestOnly ? 'O' : '-'}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(p)}
                    className="rounded border border-ink-500 px-2 py-1 text-xs hover:border-[var(--color-wa)] hover:text-[var(--color-wa)]"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
