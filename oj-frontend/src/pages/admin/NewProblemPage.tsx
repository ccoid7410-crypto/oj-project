import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { Difficulty } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { TIER_OPTIONS, labelOfLevel } from '../../lib/difficulty';

interface TestCaseInput {
  input: string;
  output: string;
  isSample: boolean;
}

function emptyTestCase(isSample: boolean): TestCaseInput {
  return { input: '', output: '', isSample };
}

export function NewProblemPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<Difficulty>('BRONZE');
  const [subRank, setSubRank] = useState(5); // 1(V, 가장 쉬움) ~ 5(I, 가장 어려움)
  const level = (TIER_OPTIONS.find((t) => t.difficulty === tier)?.base ?? 0) + subRank;
  const [timeLimitMs, setTimeLimitMs] = useState(2000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(256);
  const [tags, setTags] = useState('');
  const [testCases, setTestCases] = useState<TestCaseInput[]>([emptyTestCase(true)]);
  const [publishNow, setPublishNow] = useState(isAdmin);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateTestCase(index: number, patch: Partial<TestCaseInput>) {
    setTestCases((prev) => prev.map((tc, i) => (i === index ? { ...tc, ...patch } : tc)));
  }

  function addTestCase() {
    setTestCases((prev) => [...prev, emptyTestCase(false)]);
  }

  function removeTestCase(index: number) {
    setTestCases((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<{ id: string }>('/problems', {
        title,
        slug,
        description,
        level,
        timeLimitMs,
        memoryLimitMb,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        testCases,
      });
      if (isAdmin && publishNow) {
        await api.patch(`/problems/${created.id}/publish`, { isPublished: true });
        navigate(`/problems/${slug}`);
      } else if (!isAdmin) {
        // 일반 사용자가 만든 문제는 자동으로 검토 대기 상태가 된다. 승인 전까지는 내 문제 목록에서 확인.
        navigate('/problems/mine');
      } else {
        navigate(`/problems/${slug}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '문제 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]';

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">문제 추가</h1>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          제목
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          slug (URL에 쓰일 식별자, 영문/숫자/하이픈)
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
            required
            rows={5}
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

        <label className="flex flex-col gap-1 text-sm">
          태그 (쉼표로 구분)
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="dp, graph, greedy"
            className={inputClass}
          />
        </label>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-fg-muted">테스트케이스</h2>
            <button
              type="button"
              onClick={addTestCase}
              className="rounded border border-ink-500 px-2 py-1 text-xs hover:border-[var(--color-brand)]"
            >
              + 추가
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-4">
            {testCases.map((tc, i) => (
              <div key={i} className="rounded border border-ink-500 bg-ink-700 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-fg-muted">
                    <input
                      type="checkbox"
                      checked={tc.isSample}
                      onChange={(e) => updateTestCase(i, { isSample: e.target.checked })}
                    />
                    예제로 공개 (sample)
                  </label>
                  {testCases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTestCase(i)}
                      className="text-xs text-fg-muted hover:text-fg"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs text-fg-muted">
                    input
                    <textarea
                      required
                      rows={3}
                      value={tc.input}
                      onChange={(e) => updateTestCase(i, { input: e.target.value })}
                      className={`${inputClass} resize-y`}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-fg-muted">
                    output
                    <textarea
                      required
                      rows={3}
                      value={tc.output}
                      onChange={(e) => updateTestCase(i, { output: e.target.value })}
                      className={`${inputClass} resize-y`}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {isAdmin ? (
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
            생성 후 바로 공개
          </label>
        ) : (
          <p className="text-xs text-fg-muted">
            일반 계정으로 만든 문제는 자동으로 "검토 대기" 상태가 되고, 관리자가 승인해야 공개됩니다. 진행 상황은{' '}
            <span className="font-medium">내 문제</span> 메뉴에서 확인할 수 있어요.
          </p>
        )}

        {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded bg-[var(--color-brand)] py-2 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '생성 중...' : '문제 생성'}
        </button>
      </form>
    </div>
  );
}
