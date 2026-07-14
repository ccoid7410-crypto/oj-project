import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { Difficulty, Language } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { TIER_OPTIONS, labelOfLevel } from '../../lib/difficulty';
import { LANGUAGE_OPTIONS, DEFAULT_TEMPLATE } from '../../lib/languages';
import { TestCaseDraftList, type TestCaseDraft } from '../../components/TestCaseDraftList';
import { TagPicker } from '../../components/TagPicker';

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
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  // 임시 저장본이 있으면 그 값으로 시작한다 (lazy initializer라 최초 렌더 1회만 읽음)
  const [restored] = useState<ProblemDraft | null>(loadDraft);
  const [draftNotice, setDraftNotice] = useState(restored != null);
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
  const [verificationLanguage, setVerificationLanguage] = useState<Language>(
    restored?.verificationLanguage ?? 'CPP',
  );
  const [verificationCode, setVerificationCode] = useState(
    restored?.verificationCode ?? DEFAULT_TEMPLATE.CPP,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 입력이 멈춘 뒤 1초 후에 저장(디바운스). 대용량 테스트케이스 연타 저장으로 인한 렉 방지.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const draft: ProblemDraft = {
        title, slug, description, tier, subRank, timeLimitMs, memoryLimitMb,
        tags, testCases, contestOnly, verificationLanguage, verificationCode,
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
  }, [title, slug, description, tier, subRank, timeLimitMs, memoryLimitMb, tags, testCases, contestOnly, verificationLanguage, verificationCode]);

  function discardDraft() {
    localStorage.removeItem(DRAFT_KEY);
    window.location.reload(); // 빈 폼으로 재시작
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
        tags,
        testCases,
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
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">문제 추가</h1>
      {draftNotice && (
        <p className="mt-2 flex items-center gap-2 rounded border border-ink-500 bg-ink-700 p-2 text-xs text-fg-muted">
          작성 중이던 임시 저장본을 불러왔습니다.
          <button type="button" onClick={discardDraft} className="underline hover:text-[var(--color-wa)]">
            버리고 새로 쓰기
          </button>
          <button type="button" onClick={() => setDraftNotice(false)} className="underline hover:text-[var(--color-brand)]">
            닫기
          </button>
        </p>
      )}

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

        <TagPicker value={tags} onChange={setTags} />

        <div>
          <h2 className="text-sm font-bold text-fg-muted">테스트케이스</h2>
          <p className="mt-1 text-xs text-fg-muted">
            직접 입력하거나, zip을 올리면 각 케이스가 아래 칸에 채워집니다. 채워진 뒤에도 수정할 수 있어요.
          </p>
          <div className="mt-3">
            <TestCaseDraftList value={testCases} onChange={setTestCases} inputClass={inputClass} />
          </div>
        </div>

        {isAdmin ? (
          <>
            <label className="flex items-center gap-2 text-xs text-fg-muted">
              <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
              생성 후 바로 공개
            </label>
            <label className="flex items-center gap-2 text-xs text-fg-muted">
              <input type="checkbox" checked={contestOnly} onChange={(e) => setContestOnly(e.target.checked)} />
              대회 전용 문제로 만들기 (대회 종료 전까지 일반 문제 목록에 안 보임, "대회전용" 태그 자동 부여)
            </label>
          </>
        ) : (
          <div>
            <p className="text-xs text-fg-muted">
              일반 계정으로 만든 문제는 자동으로 "검토 대기" 상태가 되고, 관리자가 승인해야 공개됩니다. 진행 상황은{' '}
              <span className="font-medium">내 문제</span> 메뉴에서 확인할 수 있어요.
            </p>
            <div className="mt-3 rounded border border-ink-500 bg-ink-700 p-3">
              <p className="text-sm font-bold">검증용 정답 코드 (필수)</p>
              <p className="mt-1 text-xs text-fg-muted">
                위에 넣은 테스트케이스를 실제로 통과하는 코드를 제출해야 문제가 등록됩니다. 통과하지 못하면
                등록이 취소돼요.
              </p>
              <select
                value={verificationLanguage}
                onChange={(e) => {
                  const lang = e.target.value as Language;
                  setVerificationLanguage(lang);
                  setVerificationCode(DEFAULT_TEMPLATE[lang]);
                }}
                className="mt-2 rounded border border-ink-500 bg-white px-2 py-1 text-xs"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <textarea
                required
                rows={10}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                spellCheck={false}
                className="mt-2 w-full resize-y rounded border border-ink-500 bg-white p-2 font-mono text-xs outline-none focus:border-[var(--color-brand)]"
              />
            </div>
          </div>
        )}

        {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded bg-[var(--color-brand)] py-2 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? (isAdmin ? '생성 중...' : '코드 검증 중... (최대 30초)') : '문제 생성'}
        </button>
      </form>
    </div>
  );
}
