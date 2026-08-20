import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type {
  Difficulty,
  Language,
  ProblemDetail,
  ProblemType,
  ScoringMode,
  TestCase,
} from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { TIER_OPTIONS, labelOfLevel, tierOfLevel } from '../../lib/difficulty';
import { LANGUAGE_OPTIONS, DEFAULT_TEMPLATE } from '../../lib/languages';
import { TestCaseDraftList, type TestCaseDraft } from '../../components/TestCaseDraftList';
import { TagPicker } from '../../components/TagPicker';
import { ProblemAdvancedSettings } from '../../components/ProblemAdvancedSettings';

import { MarkdownEditor } from '../../components/MarkdownEditor';

// Ace 에디터 번들이 커서 필요할 때만 lazy load 한다.
const CodeEditor = lazy(() =>
  import('../../components/CodeEditor').then((m) => ({ default: m.CodeEditor })),
);

type TestCaseInput = TestCaseDraft;

function emptyTestCase(isSample: boolean): TestCaseInput {
  return { input: '', output: '', isSample };
}

// ===== 임시 저장 =====
// 작성 중인 폼 전체를 localStorage에 자동 저장해서, 실수로 창을 닫아도 이어서 쓸 수 있게 한다.
const DRAFT_KEY = 'oj_problem_draft';

interface ProblemDraft {
  title: string;
  slug: string;
  description: string;
  tier: Difficulty;
  subRank: number;
  timeLimitMs: number;
  memoryLimitMb: number;
  tags: string[];
  testCases: TestCaseInput[];
  contestOnly: boolean;
  problemType: ProblemType;
  scoringMode: ScoringMode;
  maxScore: number;
  isPractice: boolean;
  allowedLanguages: Language[];
  compileOptions: Partial<Record<Language, string[]>>;
  verificationLanguage: Language;
  verificationCode: string;
}

function loadDraft(): ProblemDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as ProblemDraft;
    // 완전히 빈 초안은 복원할 가치가 없다
    if (!d.title && !d.slug && !d.description) return null;
    return d;
  } catch {
    return null;
  }
}

export function NewProblemPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  // '내 문제'에서 초안을 이어서 작성할 때 넘어오는 slug. 있으면 서버 초안을 불러오고,
  // 그 동안엔 localStorage 임시 저장본은 무시한다(서버 초안이 우선).
  const resumeSlug = searchParams.get('resume');
  // 임시 저장본이 있으면 그 값으로 시작한다 (lazy initializer라 최초 렌더 1회만 읽음)
  const [restored] = useState<ProblemDraft | null>(() => (resumeSlug ? null : loadDraft()));
  const [draftNotice, setDraftNotice] = useState(restored != null);
  // 서버에 저장된 초안의 문제 id. 있으면 '임시 저장'과 '문제 생성'이 이 초안을 갱신/승격한다.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(!!resumeSlug);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedNotice, setDraftSavedNotice] = useState<string | null>(null);
  const [title, setTitle] = useState(restored?.title ?? '');
  const [slug, setSlug] = useState(restored?.slug ?? '');
  const [description, setDescription] = useState(restored?.description ?? '');
  const [tier, setTier] = useState<Difficulty>(restored?.tier ?? 'BRONZE');
  const [subRank, setSubRank] = useState(restored?.subRank ?? 5); // 1(V, 가장 쉬움) ~ 5(I, 가장 어려움)
  const level = (TIER_OPTIONS.find((t) => t.difficulty === tier)?.base ?? 0) + subRank;
  const [timeLimitMs, setTimeLimitMs] = useState(restored?.timeLimitMs ?? 2000);
  const [memoryLimitMb, setMemoryLimitMb] = useState(restored?.memoryLimitMb ?? 256);
  const [tags, setTags] = useState<string[]>(restored?.tags ?? []);
  const [testCases, setTestCases] = useState<TestCaseInput[]>(
    restored?.testCases?.length ? restored.testCases : [emptyTestCase(true)],
  );
  const [publishNow, setPublishNow] = useState(isAdmin);
  const [contestOnly, setContestOnly] = useState(restored?.contestOnly ?? false);
  const [problemType, setProblemType] = useState<ProblemType>(restored?.problemType ?? 'STANDARD');
  const [scoringMode, setScoringMode] = useState<ScoringMode>(restored?.scoringMode ?? 'TARGET');
  const [maxScore, setMaxScore] = useState(restored?.maxScore ?? 100);
  const [isPractice, setIsPractice] = useState(restored?.isPractice ?? false);
  const [allowedLanguages, setAllowedLanguages] = useState<Language[]>(restored?.allowedLanguages ?? []);
  const [compileOptions, setCompileOptions] = useState<Partial<Record<Language, string[]>>>(
    restored?.compileOptions ?? {},
  );
  const [verificationLanguage, setVerificationLanguage] = useState<Language>(
    restored?.verificationLanguage ?? 'CPP',
  );
  const [verificationCode, setVerificationCode] = useState(
    restored?.verificationCode ?? DEFAULT_TEMPLATE.CPP,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이어서 작성: 서버에 저장된 초안(slug)을 불러와 폼을 채운다.
  useEffect(() => {
    if (!resumeSlug) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await api.get<ProblemDetail>(`/problems/${resumeSlug}`);
        const tcs = await api.get<TestCase[]>(`/problems/${p.id}/testcases`);
        if (cancelled) return;
        setDraftId(p.id);
        setTitle(p.title);
        setSlug(p.slug);
        setDescription(p.description);
        setTier(tierOfLevel(p.level));
        setSubRank(((p.level - 1) % 5) + 1);
        setTimeLimitMs(p.timeLimitMs);
        setMemoryLimitMb(p.memoryLimitMb);
        setProblemType(p.problemType);
        setScoringMode(p.scoringMode);
        setMaxScore(p.maxScore);
        setIsPractice(p.isPractice);
        setAllowedLanguages(p.allowedLanguages);
        setCompileOptions(p.compileOptions ?? {});
        setTags(p.tags);
        setTestCases(
          tcs.length
            ? tcs.map((tc) => ({ input: tc.input, output: tc.output, isSample: tc.isSample }))
            : [emptyTestCase(true)],
        );
      } catch {
        if (!cancelled) setError('초안을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoadingDraft(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // resumeSlug가 바뀔 때만 다시 불러온다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSlug]);

  // 입력이 멈춘 뒤 1초 후에 저장(디바운스). 대용량 테스트케이스 연타 저장으로 인한 렉 방지.
  // 서버 초안(draftId/resume)으로 작업 중이면 localStorage 자동 저장은 끈다(서버가 이미 보관).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (draftId || resumeSlug) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const draft: ProblemDraft = {
        title, slug, description, tier, subRank, timeLimitMs, memoryLimitMb,
        tags, testCases, contestOnly, problemType, scoringMode, maxScore, isPractice,
        allowedLanguages, compileOptions, verificationLanguage, verificationCode,
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // localStorage 용량 초과(대형 테스트케이스) 등 — 임시 저장만 조용히 포기한다
      }
    }, 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draftId, resumeSlug, title, slug, description, tier, subRank, timeLimitMs, memoryLimitMb, tags, testCases, contestOnly, problemType, scoringMode, maxScore, isPractice, allowedLanguages, compileOptions, verificationLanguage, verificationCode]);

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    window.location.reload(); // 빈 폼으로 재시작
  }

  // 저장 시 빈 행(입력·출력 모두 비어있음)은 제외한 테스트케이스 목록.
  function cleanTestCases() {
    return testCases.filter((tc) => tc.input !== '' || tc.output !== '');
  }

  /** '임시 저장': 검토에 넣지 않고 서버에 초안(DRAFT)으로만 저장한다. 이후 '내 문제'에서 이어서 작성 가능. */
  async function onSaveDraft() {
    setError(null);
    setDraftSavedNotice(null);
    if (!title.trim() || !slug.trim()) {
      setError('임시 저장하려면 제목과 주소(slug)를 입력해주세요.');
      return;
    }
    setSavingDraft(true);
    try {
      if (draftId) {
        // 기존 초안 갱신: 내용 + 테스트케이스를 현재 폼 상태로 맞춘다(재검토 없음 - 초안이라).
        await api.patch(`/problems/${draftId}`, {
          title, slug, description, level, timeLimitMs, memoryLimitMb, tags,
          problemType, scoringMode, maxScore, isPractice, allowedLanguages, compileOptions,
          ...(isAdmin ? { contestOnly } : {}),
        });
        await api.put(`/problems/${draftId}/testcases`, { testCases: cleanTestCases() });
      } else {
        // 새 초안 생성
        const created = await api.post<{ id: string; slug: string }>('/problems/draft', {
          title, slug, description, level, timeLimitMs, memoryLimitMb, tags, testCases: cleanTestCases(),
          problemType, scoringMode, maxScore, isPractice, allowedLanguages, compileOptions,
          ...(isAdmin ? { contestOnly } : {}),
        });
        setDraftId(created.id);
        localStorage.removeItem(DRAFT_KEY); // 이제 서버가 보관하므로 로컬 임시본은 정리
        // 새로고침해도 이어지도록 URL에 resume 파라미터를 남긴다.
        navigate(`/problems/new?resume=${encodeURIComponent(created.slug)}`, { replace: true });
      }
      setDraftSavedNotice('임시 저장되었습니다. 내 문제에서 이어서 작성할 수 있어요.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '임시 저장에 실패했습니다.');
    } finally {
      setSavingDraft(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (draftId) {
        // 이어서 작성하던 서버 초안을 최종 등록(승격)한다.
        // 먼저 현재 폼 내용/테스트케이스를 저장한 뒤, 검증/공개 단계를 밟는다.
        await api.patch(`/problems/${draftId}`, {
          title, slug, description, level, timeLimitMs, memoryLimitMb, tags,
          problemType, scoringMode, maxScore, isPractice, allowedLanguages, compileOptions,
          ...(isAdmin ? { contestOnly } : {}),
        });
        await api.put(`/problems/${draftId}/testcases`, { testCases: cleanTestCases() });
        localStorage.removeItem(DRAFT_KEY);
        if (isAdmin) {
          if (publishNow) {
            await api.patch(`/problems/${draftId}/publish`, { isPublished: true });
            navigate(`/problems/${slug}`);
          } else {
            navigate('/problems/mine');
          }
        } else {
          // 일반 사용자: 정답 코드 검증을 통과해야 검토 대기로 넘어간다.
          await api.post(`/problems/${draftId}/verify-submit`, { verificationLanguage, verificationCode });
          navigate('/problems/mine');
        }
        return;
      }

      const created = await api.post<{ id: string }>('/problems', {
        title,
        slug,
        description,
        level,
        timeLimitMs,
        memoryLimitMb,
        tags,
        testCases,
        problemType,
        scoringMode,
        maxScore,
        isPractice,
        allowedLanguages,
        compileOptions,
        ...(isAdmin
          ? { contestOnly }
          : { verificationLanguage, verificationCode }),
      });
      localStorage.removeItem(DRAFT_KEY); // 생성 성공 → 임시 저장본 폐기
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
    <div className="flex h-[calc(100vh-64px)] w-full flex-col bg-ink-50 -mx-4 -my-6 sm:-mx-6 sm:-my-8" style={{ width: '100vw', maxWidth: 'none', marginLeft: 'calc(-50vw + 50%)' }}>
      <form onSubmit={onSubmit} className="flex h-full flex-col">
        {/* 상단 네비게이션바 */}
        <div className="flex shrink-0 items-center justify-between border-b border-ink-300 bg-white px-6 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">{resumeSlug ? '문제 이어서 작성' : '새 문제 작성'}</h1>
            {loadingDraft && <span className="text-sm text-fg-muted">초안을 불러오는 중...</span>}
            {draftNotice && (
              <div className="flex items-center gap-2 text-xs text-fg-muted bg-ink-200 px-3 py-1 rounded-full">
                임시 저장본을 불러왔습니다.
                <button type="button" onClick={discardDraft} className="underline hover:text-[var(--color-wa)] ml-2">
                  새로 쓰기
                </button>
                <button type="button" onClick={() => setDraftNotice(false)} className="underline hover:text-[var(--color-brand)] ml-2">
                  닫기
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-sm text-[var(--color-wa)]">{error}</span>}
            {draftSavedNotice && <span className="text-sm text-[var(--color-ac)]">{draftSavedNotice}</span>}
            
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={savingDraft || submitting}
              className="rounded border border-ink-500 bg-white px-4 py-2 text-sm font-bold text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] disabled:opacity-60"
            >
              {savingDraft ? '저장 중...' : '임시 저장'}
            </button>
            <button
              type="submit"
              disabled={submitting || savingDraft}
              className="rounded bg-[var(--color-brand)] px-6 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
            >
              {submitting ? (isAdmin ? '생성 중...' : '코드 검증 중...') : '문제 생성'}
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
                <label className="flex flex-col gap-1 text-sm">
                  slug (URL 식별자)
                  <input
                    required
                    pattern="^[a-z0-9-]+$"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className={inputClass}
                  />
                </label>

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
                <p className="-mt-2 text-xs text-fg-muted">
                  선택된 난이도: <span className="font-bold text-fg">{labelOfLevel(level)}</span>
                </p>

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
              <h2 className="text-lg font-bold mb-1">테스트케이스</h2>
              <p className="text-xs text-fg-muted mb-4">
                직접 입력하거나, zip을 올려 추가합니다.
              </p>
              <TestCaseDraftList value={testCases} onChange={setTestCases} inputClass={inputClass} />
            </div>

            {isAdmin ? (
              <div className="border-t border-ink-300 pt-6 flex flex-col gap-3">
                <label className="flex items-center gap-2 text-sm text-fg-muted">
                  <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
                  생성 후 바로 공개
                </label>
                <label className="flex gap-2 text-sm text-fg-muted items-start">
                  <input type="checkbox" checked={contestOnly} onChange={(e) => setContestOnly(e.target.checked)} className="mt-1" />
                  <span className="leading-tight">대회 전용 문제로 만들기<br/><span className="text-xs">일반 문제 목록에는 노출되지 않습니다</span></span>
                </label>
              </div>
            ) : (
              <div className="border-t border-ink-300 pt-6">
                <p className="text-xs text-fg-muted mb-4">
                  일반 사용자는 생성 후 <strong>검토 대기</strong> 상태가 됩니다.
                </p>
                <div className="rounded border border-ink-300 bg-white p-4 shadow-sm">
                  <p className="text-sm font-bold mb-1">검증용 정답 코드 (필수)</p>
                  <p className="text-xs text-fg-muted mb-3">
                    위 테스트케이스를 모두 통과하는 코드를 작성하세요.
                  </p>
                  <select
                    value={verificationLanguage}
                    onChange={(e) => {
                      const lang = e.target.value as Language;
                      setVerificationLanguage(lang);
                      setVerificationCode(DEFAULT_TEMPLATE[lang]);
                    }}
                    className="w-full rounded border border-ink-300 bg-white px-2 py-1.5 text-xs mb-3"
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <Suspense
                    fallback={
                      <textarea
                        required
                        rows={6}
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        spellCheck={false}
                        className="w-full resize-y rounded border border-ink-300 p-2 font-mono text-xs outline-none focus:border-[var(--color-brand)]"
                      />
                    }
                  >
                    <CodeEditor
                      value={verificationCode}
                      onChange={setVerificationCode}
                      mode={verificationLanguage}
                      autoGrow
                      minLines={8}
                    />
                  </Suspense>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
