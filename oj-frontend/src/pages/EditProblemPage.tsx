import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type {
  Difficulty,
  Language,
  ProblemDetail,
  ProblemType,
  ScoringMode,
  TestCase,
} from '../api/types';
import { useAuth } from '../context/AuthContext';
import { TIER_OPTIONS, labelOfLevel, tierOfLevel } from '../lib/difficulty';
import { TestCaseDraftList, type TestCaseDraft } from '../components/TestCaseDraftList';
import { TagPicker } from '../components/TagPicker';
import { ProblemAdvancedSettings } from '../components/ProblemAdvancedSettings';
import { MarkdownEditor } from '../components/MarkdownEditor';

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
  const [problemType, setProblemType] = useState<ProblemType>('STANDARD');
  const [scoringMode, setScoringMode] = useState<ScoringMode>('TARGET');
  const [maxScore, setMaxScore] = useState(100);
  const [isPractice, setIsPractice] = useState(false);
  const [allowedLanguages, setAllowedLanguages] = useState<Language[]>([]);
  const [compileOptions, setCompileOptions] = useState<Partial<Record<Language, string[]>>>({});
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
        setProblemType(p.problemType);
        setScoringMode(p.scoringMode);
        setMaxScore(p.maxScore);
        setIsPractice(p.isPractice);
        setAllowedLanguages(p.allowedLanguages);
        setCompileOptions(p.compileOptions ?? {});
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
        problemType,
        scoringMode,
        maxScore,
        isPractice,
        allowedLanguages,
        compileOptions,
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
    <div className="flex h-[calc(100vh-64px)] w-full flex-col bg-ink-50 -mx-4 -my-6 sm:-mx-6 sm:-my-8" style={{ width: '100vw', maxWidth: 'none', marginLeft: 'calc(-50vw + 50%)' }}>
      <form onSubmit={onSubmit} className="flex h-full flex-col">
        {/* 상단 네비게이션바 */}
        <div className="flex shrink-0 items-center justify-between border-b border-ink-300 bg-white px-6 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">문제 수정</h1>
            <span className="text-sm font-medium text-fg-muted px-2 py-0.5 bg-ink-200 rounded">{problem.title}</span>
            {user?.role !== 'ADMIN' && (
              <span className="text-xs text-[var(--color-wa)] bg-wa/10 px-2 py-1 rounded">
                공개 문제 수정 시 검토 대기 상태로 변경됩니다.
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-sm text-[var(--color-wa)]">{error}</span>}
            {notice && <span className="text-sm text-[var(--color-ac)]">{notice}</span>}
            
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-[var(--color-brand)] px-6 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* 좌측 에디터 영역 */}
          <div className="flex flex-1 flex-col overflow-y-auto border-r border-ink-300 bg-white">
            <MarkdownEditor
              title={title}
              onTitleChange={setTitle}
              content={description}
              onContentChange={setDescription}
              placeholder="문제 설명을 마크다운으로 작성하세요..."
            />
          </div>

          {/* 우측 설정 사이드바 */}
          <div className="w-[450px] shrink-0 overflow-y-auto bg-ink-50 p-6 flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold mb-4">기본 설정</h2>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
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
                    등급
                    <select value={subRank} onChange={(e) => setSubRank(Number(e.target.value))} className={inputClass}>
                      {[5, 4, 3, 2, 1].map((r) => (
                        <option key={r} value={r}>
                          {['', 'I', 'II', 'III', 'IV', 'V'][6 - r]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex items-center justify-between -mt-2">
                  <p className="text-xs text-fg-muted">
                    선택된 난이도: <span className="font-bold text-fg">{labelOfLevel(level)}</span>
                  </p>
                  {problem.difficultyVoteCount > 0 && (
                    <button
                      type="button"
                      onClick={onApplyCommunityDifficulty}
                      className="text-xs text-[var(--color-brand)] hover:underline"
                    >
                      커뮤니티 투표 반영 ({labelOfLevel(problem.difficultyVoteAverage!)})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    시간 제한 (ms)
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
                    메모리 제한 (MB)
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
              </div>
            </div>

            <div className="border-t border-ink-300 pt-6">
              <h2 className="mb-4 text-lg font-bold">문제 유형 설정</h2>
              <ProblemAdvancedSettings
                problemType={problemType}
                onProblemTypeChange={setProblemType}
                scoringMode={scoringMode}
                onScoringModeChange={setScoringMode}
                maxScore={maxScore}
                onMaxScoreChange={setMaxScore}
                isPractice={isPractice}
                onPracticeChange={setIsPractice}
                allowedLanguages={allowedLanguages}
                onAllowedLanguagesChange={setAllowedLanguages}
                compileOptions={compileOptions}
                onCompileOptionsChange={setCompileOptions}
                inputClass={inputClass}
              />
            </div>

            <div className="border-t border-ink-300 pt-6">
              <h2 className="mb-4 text-lg font-bold">태그</h2>
              <TagPicker value={tags} onChange={setTags} />
            </div>

            <div className="border-t border-ink-300 pt-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold">테스트케이스 관리</h2>
                <button
                  type="button"
                  onClick={onSaveTestCases}
                  disabled={savingTc}
                  className="rounded bg-[var(--color-brand)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
                >
                  {savingTc ? '저장 중...' : '테스트케이스만 저장'}
                </button>
              </div>
              <p className="text-xs text-fg-muted mb-4">
                수정 후 반드시 "테스트케이스만 저장" 버튼을 눌러야 적용됩니다.
              </p>
              
              {tcError && <p className="mb-2 text-xs text-[var(--color-wa)]">{tcError}</p>}
              {tcNotice && <p className="mb-2 text-xs text-[var(--color-ac)]">{tcNotice}</p>}

              <TestCaseDraftList value={drafts} onChange={setDrafts} inputClass={`${inputClass} font-mono`} />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
