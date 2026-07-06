import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type { AdminUser, ClassSummary, GroupMember, ProblemSummary } from '../../api/types';

const inputClass =
  'rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]';

export function ClassesAdminPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    api.get<ClassSummary[]>('/admin/classes').then(setClasses).catch(() => setError('수업 목록을 불러오지 못했습니다.'));
  }

  useEffect(load, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/admin/classes', { name, slug, description: description || undefined });
      setName('');
      setSlug('');
      setDescription('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '수업 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemove(id: string) {
    if (!confirm('이 수업을 삭제할까요? 등록/공지/문제 구성이 모두 사라집니다.')) return;
    await api.delete(`/admin/classes/${id}`);
    load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">수업 관리</h1>

      <form onSubmit={onCreate} className="mt-6 flex flex-col gap-4 rounded border border-ink-500 p-4">
        <p className="text-sm font-bold">새 수업 만들기</p>
        <label className="flex flex-col gap-1 text-sm">
          이름
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          slug (URL 식별자, 영문 소문자/숫자/하이픈)
          <input
            required
            pattern="^[a-z0-9-]+$"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          설명
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </label>
        {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '생성 중...' : '수업 생성'}
        </button>
      </form>

      <ul className="mt-6 flex flex-col gap-2">
        {classes.map((c) => (
          <li key={c.id} className="rounded border border-ink-500 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold">
                {c.name}{' '}
                <span className="text-xs text-fg-muted">
                  (학생 {c.memberCount}명, 문제 {c.problemCount}개)
                </span>
              </span>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  className="rounded border border-ink-500 px-2 py-1 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                >
                  {expandedId === c.id ? '닫기' : '관리'}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(c.id)}
                  className="rounded border border-ink-500 px-2 py-1 hover:border-[var(--color-wa)] hover:text-[var(--color-wa)]"
                >
                  삭제
                </button>
              </div>
            </div>
            {expandedId === c.id && <ClassManager classId={c.id} onChanged={load} />}
          </li>
        ))}
        {classes.length === 0 && <p className="text-sm text-fg-muted">아직 만든 수업이 없습니다.</p>}
      </ul>
    </div>
  );
}

function ClassManager({ classId, onChanged }: { classId: string; onChanged: () => void }) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUser[]>([]);
  const [allProblems, setAllProblems] = useState<ProblemSummary[]>([]);
  const [selectedProblemIds, setSelectedProblemIds] = useState<Set<string>>(new Set());
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [savingProblems, setSavingProblems] = useState(false);

  function loadMembers() {
    api.get<GroupMember[]>(`/admin/classes/${classId}/members`).then(setMembers);
  }

  useEffect(() => {
    loadMembers();
    api.get<ProblemSummary[]>('/problems').then(setAllProblems);
  }, [classId]);

  async function search() {
    setResults(await api.get<AdminUser[]>(`/admin/users/search?q=${encodeURIComponent(query)}`));
  }

  async function addMember(userId: string) {
    await api.post(`/admin/classes/${classId}/members`, { userId });
    loadMembers();
    onChanged();
  }

  async function removeMember(userId: string) {
    await api.delete(`/admin/classes/${classId}/members/${userId}`);
    loadMembers();
    onChanged();
  }

  function toggleProblem(id: string) {
    setSelectedProblemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveProblems() {
    setSavingProblems(true);
    try {
      await api.put(`/admin/classes/${classId}/problems`, { problemIds: Array.from(selectedProblemIds) });
      onChanged();
    } finally {
      setSavingProblems(false);
    }
  }

  async function addNotice() {
    if (!noticeTitle.trim() || !noticeContent.trim()) return;
    await api.post(`/admin/classes/${classId}/notices`, { title: noticeTitle, content: noticeContent });
    setNoticeTitle('');
    setNoticeContent('');
  }

  return (
    <div className="mt-3 flex flex-col gap-4 rounded border border-ink-500 bg-ink-700 p-3">
      <div>
        <p className="text-xs font-bold">학생 등록</p>
        <ul className="mt-1 flex flex-wrap gap-1">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-1 rounded bg-white px-2 py-1 text-xs">
              {m.username}
              <button type="button" onClick={() => removeMember(m.id)} className="text-fg-muted hover:text-[var(--color-wa)]">
                ×
              </button>
            </li>
          ))}
          {members.length === 0 && <p className="text-xs text-fg-muted">아직 등록된 학생이 없습니다.</p>}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="사용자명/이메일 검색"
            className={`${inputClass} flex-1 text-xs`}
          />
          <button type="button" onClick={search} className="rounded border border-ink-500 px-2 py-1 text-xs">
            검색
          </button>
        </div>
        {results.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {results.map((u) => (
              <li key={u.id} className="flex items-center justify-between text-xs">
                <span>{u.username}</span>
                <button
                  type="button"
                  onClick={() => addMember(u.id)}
                  className="rounded border border-ink-500 px-2 py-0.5 hover:border-[var(--color-brand)]"
                >
                  추가
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-xs font-bold">전용 문제집</p>
        <ul className="mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto">
          {allProblems.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={selectedProblemIds.has(p.id)} onChange={() => toggleProblem(p.id)} />
                {p.title}
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={saveProblems}
          disabled={savingProblems}
          className="mt-2 rounded bg-[var(--color-brand)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {savingProblems ? '저장 중...' : '문제집 저장'}
        </button>
      </div>

      <div>
        <p className="text-xs font-bold">공지 추가</p>
        <input
          value={noticeTitle}
          onChange={(e) => setNoticeTitle(e.target.value)}
          placeholder="제목"
          className={`${inputClass} mt-1 w-full text-xs`}
        />
        <textarea
          value={noticeContent}
          onChange={(e) => setNoticeContent(e.target.value)}
          placeholder="내용"
          rows={2}
          className={`${inputClass} mt-1 w-full resize-y text-xs`}
        />
        <button
          type="button"
          onClick={addNotice}
          className="mt-2 rounded border border-ink-500 px-3 py-1.5 text-xs hover:border-[var(--color-brand)]"
        >
          공지 등록
        </button>
      </div>
    </div>
  );
}
