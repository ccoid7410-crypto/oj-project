import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Difficulty, ProblemDetail, TestCase } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { TIER_OPTIONS, labelOfLevel, tierOfLevel } from '../lib/difficulty';
import { TestCaseTextField } from '../components/TestCaseTextField';

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

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [tcError, setTcError] = useState<string | null>(null);
  const [newInput, setNewInput] = useState('');
  const [newOutput, setNewOutput] = useState('');
  const [newIsSample, setNewIsSample] = useState(false);
  const [savingTc, setSavingTc] = useState(false);

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
        return api.get<TestCase[]>(`/problems/${p.id}/testcases`);
      })
      .then((tcs) => setTestCases(tcs))
      .catch(() => setError('문제를 찾을 수 없습니다.'));
  }

  useEffect(load, [slug]);

  async function reloadTestCases() {
    if (!problem) return;
    setTestCases(await api.get<TestCase[]>(`/problems/${problem.id}/testcases`));
  }

  async function onAddTestCase(e: FormEvent) {
    e.preventDefault();
    if (!problem) return;
    setSavingTc(true);
    setTcError(null);
    try {
      await api.post(`/problems/${problem.id}/testcases`, {
        input: newInput,
        output: newOutput,
        isSample: newIsSample,
      });
      setNewInput('');
      setNewOutput('');
      setNewIsSample(false);
      await reloadTestCases();
    } catch (err) {
      setTcError(err instanceof ApiError ? err.message : '테스트케이스 추가에 실패했습니다.');
    } finally {
      setSavingTc(false);
    }
  }

  async function onToggleSample(tc: TestCase) {
    if (!problem) return;
    setTcError(null);
    try {
      await api.patch(`/problems/${problem.id}/testcases/${tc.id}`, { isSample: !tc.isSample });
      await reloadTestCases();
    } catch (err) {
      setTcError(err instanceof ApiError ? err.message : '수정에 실패했습니다.');
    }
  }

  async function onDeleteTestCase(tc: TestCase) {
    if (!problem) return;
    if (!confirm('이 테스트케이스를 삭제할까요?')) return;
    setTcError(null);
    try {
      await api.delete(`/problems/${problem.id}/testcases/${tc.id}`);
      await reloadTestCases();
    } catch (err) {
      setTcError(err instanceof ApiError ? err.message : '삭제에 실패했습니다.');
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

      <div className="mt-10 border-t border-ink-500 pt-6">
        <h2 className="text-lg font-bold">테스트케이스 관리</h2>
        <p className="mt-1 text-xs text-fg-muted">
          샘플로 표시한 테스트케이스는 문제 페이지에 공개되고, 아닌 것은 채점에만 쓰이는 히든 케이스입니다.
        </p>

        {tcError && <p className="mt-2 text-xs text-[var(--color-wa)]">{tcError}</p>}

        <ul className="mt-4 flex flex-col gap-2">
          {testCases.map((tc, idx) => (
            <li key={tc.id} className="rounded border border-ink-500 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">
                  #{idx + 1} {tc.isSample && <span className="text-[var(--color-ac)]">(샘플)</span>}
                </span>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onToggleSample(tc)}
                    className="rounded border border-ink-500 px-2 py-1 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                  >
                    {tc.isSample ? '샘플 해제' : '샘플로 표시'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTestCase(tc)}
                    className="rounded border border-ink-500 px-2 py-1 hover:border-[var(--color-wa)] hover:text-[var(--color-wa)]"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-fg-muted">입력</p>
                  <pre className="mt-1 overflow-x-auto rounded bg-ink-700 p-2 text-xs whitespace-pre-wrap">{tc.input}</pre>
                </div>
                <div>
                  <p className="text-xs text-fg-muted">출력</p>
                  <pre className="mt-1 overflow-x-auto rounded bg-ink-700 p-2 text-xs whitespace-pre-wrap">{tc.output}</pre>
                </div>
              </div>
            </li>
          ))}
          {testCases.length === 0 && <p className="text-sm text-fg-muted">아직 테스트케이스가 없습니다.</p>}
        </ul>

        <form onSubmit={onAddTestCase} className="mt-6 flex flex-col gap-3 rounded border border-ink-500 p-4">
          <p className="text-sm font-bold">새 테스트케이스 추가</p>
          <div className="grid grid-cols-2 gap-3">
            <TestCaseTextField label="입력" value={newInput} onChange={setNewInput} rows={4} className={`${inputClass} font-mono`} />
            <TestCaseTextField label="출력" value={newOutput} onChange={setNewOutput} rows={4} className={`${inputClass} font-mono`} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={newIsSample} onChange={(e) => setNewIsSample(e.target.checked)} />
            샘플로 공개(문제 페이지에 노출)
          </label>
          <button
            type="submit"
            disabled={savingTc}
            className="self-start rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
          >
            {savingTc ? '추가 중...' : '테스트케이스 추가'}
          </button>
        </form>
      </div>
    </div>
  );
}
