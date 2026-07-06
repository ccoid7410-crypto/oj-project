import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type { ContestDetail, ContestSummary, ProblemSummary } from '../../api/types';

const PHASE_LABEL: Record<string, string> = {
  UPCOMING: '예정',
  RUNNING: '진행 중',
  ENDED: '종료',
};

const inputClass =
  'rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]';

export function ContestsAdminPage() {
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [problemsVisibleAfterEnd, setProblemsVisibleAfterEnd] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  function loadContests() {
    api
      .get<ContestSummary[]>('/contests')
      .then(setContests)
      .catch(() => setError('대회 목록을 불러오지 못했습니다.'));
  }

  useEffect(loadContests, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/contests', {
        title,
        slug,
        description: description || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        problemsVisibleAfterEnd,
      });
      setTitle('');
      setSlug('');
      setDescription('');
      setStartsAt('');
      setEndsAt('');
      setProblemsVisibleAfterEnd(true);
      loadContests();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '대회 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">대회 관리</h1>

      <form onSubmit={onCreate} className="mt-6 flex flex-col gap-4 rounded border border-ink-500 p-4">
        <p className="text-sm font-bold">새 대회 만들기</p>
        <label className="flex flex-col gap-1 text-sm">
          제목
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
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
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            시작
            <input
              required
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            종료
            <input
              required
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={problemsVisibleAfterEnd}
            onChange={(e) => setProblemsVisibleAfterEnd(e.target.checked)}
          />
          대회 전용(대회전용 태그) 문제를 대회 종료 후 일반 문제 목록에 공개
        </label>
        {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '생성 중...' : '대회 생성'}
        </button>
        <p className="text-xs text-fg-muted">
          생성 후 아래 목록에서 "문제 구성"을 눌러 이 대회에 포함할 문제를 고르세요. 대회 전용 문제는
          "문제 추가"에서 어드민으로 만들 때 "대회 전용" 체크박스를 켜면 됩니다.
        </p>
      </form>

      <ul className="mt-6 flex flex-col gap-2">
        {contests.map((c) => (
          <li key={c.id} className="rounded border border-ink-500 p-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold">{c.title}</span>{' '}
                <span className="text-xs text-fg-muted">
                  ({PHASE_LABEL[c.phase] ?? c.phase}, 문제 {c.problemCount}개, 참가자 {c.participantCount}명)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedSlug(expandedSlug === c.slug ? null : c.slug)}
                className="rounded border border-ink-500 px-2 py-1 text-xs hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              >
                {expandedSlug === c.slug ? '닫기' : '문제 구성'}
              </button>
            </div>
            {expandedSlug === c.slug && <ContestProblemsEditor slug={c.slug} onSaved={loadContests} />}
          </li>
        ))}
        {contests.length === 0 && <p className="text-sm text-fg-muted">아직 만든 대회가 없습니다.</p>}
      </ul>
    </div>
  );
}

function ContestProblemsEditor({ slug, onSaved }: { slug: string; onSaved: () => void }) {
  const [detail, setDetail] = useState<ContestDetail | null>(null);
  const [allProblems, setAllProblems] = useState<ProblemSummary[]>([]);
  const [selected, setSelected] = useState<Record<string, { checked: boolean; points: number; label: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<ContestDetail>(`/contests/${slug}`), api.get<ProblemSummary[]>('/problems')])
      .then(([d, problems]) => {
        setDetail(d);
        setAllProblems(problems);
        const map: Record<string, { checked: boolean; points: number; label: string }> = {};
        for (const p of problems) {
          const existing = d.problems.find((cp) => cp.problemId === p.id);
          map[p.id] = {
            checked: !!existing,
            points: existing?.points ?? 100,
            label: existing?.label ?? '',
          };
        }
        setSelected(map);
      })
      .catch(() => setError('대회/문제 정보를 불러오지 못했습니다.'));
  }, [slug]);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const problems = Object.entries(selected)
        .filter(([, v]) => v.checked)
        .map(([problemId, v]) => ({ problemId, points: v.points, label: v.label || undefined }));
      await api.put(`/contests/${detail!.id}/problems`, { problems });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p className="mt-3 text-xs text-[var(--color-wa)]">{error}</p>;
  if (!detail) return <p className="mt-3 text-xs text-fg-muted">불러오는 중...</p>;

  return (
    <div className="mt-3 rounded border border-ink-500 bg-ink-700 p-3">
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {allProblems.map((p) => {
          const s = selected[p.id];
          if (!s) return null;
          return (
            <li key={p.id} className="flex items-center gap-2 text-xs">
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.checked}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [p.id]: { ...prev[p.id], checked: e.target.checked } }))}
                />
                {p.title}
              </label>
              <input
                type="number"
                min={0}
                value={s.points}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, [p.id]: { ...prev[p.id], points: Number(e.target.value) } }))
                }
                className="w-20 rounded border border-ink-500 bg-white px-2 py-1"
                title="배점"
              />
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="mt-3 rounded bg-[var(--color-brand)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
      >
        {saving ? '저장 중...' : '문제 구성 저장'}
      </button>
    </div>
  );
}
