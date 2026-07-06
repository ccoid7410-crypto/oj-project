import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Difficulty, ProblemDetail } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { TIER_OPTIONS, labelOfLevel, tierOfLevel } from '../lib/difficulty';

export function EditProblemPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<Difficulty>('BRONZE');
  const [subRank, setSubRank] = useState(5);
  const [timeLimitMs, setTimeLimitMs] = useState(2000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(256);
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const level = (TIER_OPTIONS.find((t) => t.difficulty === tier)?.base ?? 0) + subRank;

  function load() {
    if (!slug) return;
    api
      .get<ProblemDetail>(`/problems/${slug}`)
      .then((p) => {
        setProblem(p);
        setTitle(p.title);
        setDescription(p.description);
        setTier(tierOfLevel(p.level));
        setSubRank(((p.level - 1) % 5) + 1);
        setTimeLimitMs(p.timeLimitMs);
        setMemoryLimitMb(p.memoryLimitMb);
        setTags(p.tags.join(', '));
      })
      .catch(() => setError('문제를 찾을 수 없습니다.'));
  }

  useEffect(load, [slug]);

  const canEdit = !!user && !!problem && (user.role === 'ADMIN' || user.id === problem.authorId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!problem) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/problems/${problem.id}`, {
        title,
        description,
        level,
        timeLimitMs,
        memoryLimitMb,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      navigate(`/problems/${slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onApplyCommunityDifficulty() {
    if (!problem) return;
    setNotice(null);
    setError(null);
    try {
      const updated = await api.post<ProblemDetail>(`/problems/${problem.id}/apply-community-difficulty`);
      setTier(tierOfLevel(updated.level));
      setSubRank(((updated.level - 1) % 5) + 1);
      setNotice(`커뮤니티 평균(${labelOfLevel(updated.level)})을 반영했습니다. 저장을 눌러야 확정됩니다.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '적용에 실패했습니다.');
    }
  }

  if (error && !problem) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!problem) return <p className="text-sm text-fg-muted">불러오는 중...</p>;
  if (!canEdit) return <p className="text-sm text-[var(--color-wa)]">이 문제를 수정할 권한이 없습니다.</p>;

  const inputClass =
    'rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]';

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">문제 수정 — {problem.title}</h1>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          제목
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          설명
          <textarea
            required
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </label>

        <div className="grid grid-cols-4 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            티어
            <select value={tier} onChange={(e) => setTier(e.target.value as Difficulty)} className={inputClass}>
              {TIER_OPTIONS.map((t) => (
                <option key={t.difficulty} value={t.difficulty}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            세부 등급
            <select value={subRank} onChange={(e) => setSubRank(Number(e.target.value))} className={inputClass}>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {['', 'I', 'II', 'III', 'IV', 'V'][6 - r]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            시간 제한(ms)
            <input
              type="number"
              min={100}
              required
              value={timeLimitMs}
              onChange={(e) => setTimeLimitMs(Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            메모리 제한(MB)
            <input
              type="number"
              min={16}
              required
              value={memoryLimitMb}
              onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
              className={inputClass}
            />
          </label>
        </div>
        <p className="-mt-2 text-xs text-fg-muted">
          선택된 난이도: <span className="font-bold text-fg">{labelOfLevel(level)}</span> (레벨 {level})
        </p>

        {problem.difficultyVoteCount > 0 && (
          <div className="rounded border border-ink-500 bg-ink-700 p-3 text-xs">
            <p className="text-fg-muted">
              커뮤니티 체감 난이도: <span className="font-bold text-fg">{labelOfLevel(problem.difficultyVoteAverage!)}</span>{' '}
              ({problem.difficultyVoteCount}명 투표)
            </p>
            <button
              type="button"
              onClick={onApplyCommunityDifficulty}
              className="mt-2 rounded border border-ink-500 px-2 py-1 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              이 값으로 티어/등급 채우기
            </button>
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm">
          태그 (쉼표로 구분)
          <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} />
        </label>

        {notice && <p className="text-xs text-[var(--color-ac)]">{notice}</p>}
        {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded bg-[var(--color-brand)] py-2 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '저장 중...' : '저장'}
        </button>
      </form>
    </div>
  );
}
