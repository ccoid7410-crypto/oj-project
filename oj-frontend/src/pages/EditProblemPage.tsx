import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Difficulty, ProblemDetail, TestCase } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { TIER_OPTIONS, labelOfLevel, tierOfLevel } from '../lib/difficulty';
import { TestCaseDraftList, type TestCaseDraft } from '../components/TestCaseDraftList';
import { TagPicker } from '../components/TagPicker';

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
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [tcError, setTcError] = useState<string | null>(null);
  const [tcNotice, setTcNotice] = useState<string | null>(null);
  // 기존 저장된 케이스와 새로 추가할 케이스를 하나의 편집 목록으로 다룬다.
  // id가 있으면 기존 케이스(저장 시 업데이트), 없으면 새 케이스(저장 시 생성).
  const [drafts, setDrafts] = useState<TestCaseDraft[]>([]);
  const [savingTc, setSavingTc] = useState(false);

  const level = (TIER_OPTIONS.find((t) => t.difficulty === tier)?.base ?? 0) + subRank;

  function tcToDraft(tc: TestCase): TestCaseDraft {
    return { id: tc.id, input: tc.input, output: tc.output, isSample: tc.isSample };
  }

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
        setTags(p.tags);
        return api.get<TestCase[]>(`/problems/${p.id}/testcases`);
      })
      .then((tcs) => setDrafts(tcs.map(tcToDraft)))
      .catch(() => setError('문제를 찾을 수 없습니다.'));
  }

  useEffect(load, [slug]);

  async function onSaveTestCases() {
    if (!problem) return;
    // 입력·출력이 모두 빈 행은 저장하지 않는다.
    const cases = drafts.filter((d) => d.input !== '' || d.output !== '');
    setSavingTc(true);
    setTcError(null);
    setTcNotice(null);
    try {
      const saved = await api.put<TestCase[]>(`/problems/${problem.id}/testcases`, { testCases: cases });
      setDrafts(saved.map(tcToDraft));
      setTcNotice('테스트케이스를 저장했습니다.');
    } catch (err) {
      setTcError(err instanceof ApiError ? err.message : '테스트케이스 저장에 실패했습니다.');
    } finally {
      setSavingTc(false);
    }
  }

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
        tags,
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

        <TagPicker value={tags} onChange={setTags} />

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

      <div className="mt-10 border-t border-ink-500 pt-6">
        <h2 className="text-lg font-bold">테스트케이스 관리</h2>
        <p className="mt-1 text-xs text-fg-muted">
          기존 케이스가 아래에 그대로 불러와집니다. 직접 수정하거나 zip으로 채운 뒤 저장하세요. 삭제한 행은
          저장 시 실제로 삭제되고, 샘플로 표시한 케이스만 문제 페이지에 공개됩니다.
        </p>

        {tcError && <p className="mt-2 text-xs text-[var(--color-wa)]">{tcError}</p>}
        {tcNotice && <p className="mt-2 text-xs text-[var(--color-ac)]">{tcNotice}</p>}

        <div className="mt-4">
          <TestCaseDraftList value={drafts} onChange={setDrafts} inputClass={`${inputClass} font-mono`} />
        </div>
        <button
          type="button"
          onClick={onSaveTestCases}
          disabled={savingTc}
          className="mt-3 rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {savingTc ? '저장 중...' : '테스트케이스 저장'}
        </button>
      </div>
    </div>
  );
}
