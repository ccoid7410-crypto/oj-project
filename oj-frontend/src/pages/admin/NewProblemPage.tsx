import { useState, type FormEvent } from 'react';
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
  const [tags, setTags] = useState<string[]>([]);
  const [testCases, setTestCases] = useState<TestCaseInput[]>([emptyTestCase(true)]);
  const [publishNow, setPublishNow] = useState(isAdmin);
  const [contestOnly, setContestOnly] = useState(false);
  const [verificationLanguage, setVerificationLanguage] = useState<Language>('CPP');
  const [verificationCode, setVerificationCode] = useState(DEFAULT_TEMPLATE.CPP);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
