import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Language, ProblemDetail } from '../api/types';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_TEMPLATE, LANGUAGE_OPTIONS } from '../lib/languages';
import { labelOfLevel, LEVEL_MAX, LEVEL_MIN } from '../lib/difficulty';
import { ProblemComments } from '../components/ProblemComments';

// Ace 에디터 번들이 커서 필요할 때만 lazy load 한다.
const CodeEditor = lazy(() =>
  import('../components/CodeEditor').then((m) => ({ default: m.CodeEditor })),
);

// KaTeX(수식) 번들이 커서 문제 페이지에서만 lazy load 한다.
const MarkdownView = lazy(() =>
  import('../components/MarkdownView').then((m) => ({ default: m.MarkdownView })),
);

export function ProblemDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contestId = searchParams.get('contestId');

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [language, setLanguage] = useState<Language>('CPP');
  const [code, setCode] = useState(DEFAULT_TEMPLATE.CPP);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteLevel, setVoteLevel] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);

  function loadProblem() {
    if (!slug) return;
    api
      .get<ProblemDetail>(`/problems/${slug}${contestId ? `?contestId=${contestId}` : ''}`)
      .then((p) => {
        setProblem(p);
        setVoteLevel(p.myDifficultyVote ?? p.level);
      })
      .catch(() => setError('문제를 불러오지 못했습니다.'));
  }

  useEffect(loadProblem, [slug]);

  async function onVote() {
    if (!problem || voteLevel == null) return;
    setVoting(true);
    try {
      await api.post(`/problems/${problem.id}/difficulty-vote`, { level: voteLevel });
      loadProblem();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '난이도 투표에 실패했습니다.');
    } finally {
      setVoting(false);
    }
  }

  function onLanguageChange(next: Language) {
    setLanguage(next);
    // 아직 직접 코드를 안 건드렸으면 템플릿도 같이 바꿔줌
    setCode((prev) => (Object.values(DEFAULT_TEMPLATE).includes(prev) ? DEFAULT_TEMPLATE[next] : prev));
  }

  // 프로필에 설정한 기본 제출 언어를 자동 선택한다.
  useEffect(() => {
    if (user?.preferredLanguage) onLanguageChange(user.preferredLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.preferredLanguage]);

  async function onSubmit() {
    if (!problem) return;
    setSubmitting(true);
    setError(null);
    try {
      const submission = await api.post<{ id: string }>('/submissions', {
        problemId: problem.id,
        contestId: contestId ?? undefined,
        language,
        sourceCode: code,
      });
      navigate(`/submissions/${submission.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !problem) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!problem) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <span>{problem.displayId}번</span>
          {contestId && <span className="font-bold text-[var(--color-brand)]">대회 제출 모드</span>}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {problem.myStatus === 'solved' && (
            <span className="rounded bg-[var(--color-ac)] px-2 py-0.5 text-xs font-bold text-white">
              정답
            </span>
          )}
          {problem.myStatus === 'attempted' && (
            <span className="rounded bg-[var(--color-wa)] px-2 py-0.5 text-xs font-bold text-white">
              오답
            </span>
          )}
          <DifficultyBadge level={problem.level} />
          <h1 className="text-2xl font-bold">{problem.title}</h1>
          {user && (user.role === 'ADMIN' || user.id === problem.authorId) && (
            <Link
              to={`/problems/${problem.slug}/edit`}
              className="ml-auto rounded border border-ink-500 px-2 py-1 text-xs text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              수정
            </Link>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded border border-ink-500 bg-ink-500 text-center text-xs sm:grid-cols-6">
          <div className="bg-white px-2 py-2">
            <div className="text-fg-muted">시간 제한</div>
            <div className="mt-0.5 font-semibold">{problem.timeLimitMs}ms</div>
          </div>
          <div className="bg-white px-2 py-2">
            <div className="text-fg-muted">메모리 제한</div>
            <div className="mt-0.5 font-semibold">{problem.memoryLimitMb}MB</div>
          </div>
          <div className="bg-white px-2 py-2">
            <div className="text-fg-muted">제출</div>
            <div className="mt-0.5 font-semibold">{problem.submissionCount}</div>
          </div>
          <div className="bg-white px-2 py-2">
            <div className="text-fg-muted">정답</div>
            <div className="mt-0.5 font-semibold">{problem.acceptedCount}</div>
          </div>
          <div className="bg-white px-2 py-2">
            <div className="text-fg-muted">맞힌 사람</div>
            <div className="mt-0.5 font-semibold">{problem.solvedCount}</div>
          </div>
          <div className="bg-white px-2 py-2">
            <div className="text-fg-muted">정답 비율</div>
            <div className="mt-0.5 font-semibold">
              {problem.submissionCount > 0 ? `${problem.accuracy}%` : '-'}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded border border-ink-500 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-fg-muted">
              체감 난이도{' '}
              {problem.difficultyVoteCount > 0 ? (
                <>
                  <span className="font-bold text-fg">{labelOfLevel(problem.difficultyVoteAverage!)}</span>{' '}
                  ({problem.difficultyVoteCount}명 투표)
                </>
              ) : (
                '아직 투표가 없습니다'
              )}
            </span>
          </div>
          {problem.canVoteDifficulty ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={LEVEL_MIN}
                max={LEVEL_MAX}
                value={voteLevel ?? problem.level}
                onChange={(e) => setVoteLevel(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-24 text-center font-bold">{labelOfLevel(voteLevel ?? problem.level)}</span>
              <button
                onClick={onVote}
                disabled={voting}
                className="rounded bg-[var(--color-brand)] px-3 py-1 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
              >
                {problem.myDifficultyVote != null ? '다시 투표' : '투표'}
              </button>
            </div>
          ) : (
            <p className="mt-1 text-fg-muted">이 문제를 맞혀야 체감 난이도에 투표할 수 있어요.</p>
          )}
        </div>

        <h2 className="mt-6 border-b border-ink-500 pb-1 text-base font-bold">문제</h2>
        <Suspense
          fallback={
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">{problem.description}</p>
          }
        >
          <MarkdownView content={problem.description} className="mt-3 text-fg" />
        </Suspense>

        {problem.testCases.length > 0 && (
          <div className="mt-8 space-y-5">
            {problem.testCases.map((tc, i) => (
              <div key={tc.id}>
                <h3 className="border-b border-ink-500 pb-1 text-sm font-bold">예제 입력 {i + 1}</h3>
                <pre className="mt-2 rounded border border-ink-600 bg-ink-700 p-3 font-mono text-xs">{tc.input}</pre>
                <h3 className="mt-3 border-b border-ink-500 pb-1 text-sm font-bold">예제 출력 {i + 1}</h3>
                <pre className="mt-2 rounded border border-ink-600 bg-ink-700 p-3 font-mono text-xs">{tc.output}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as Language)}
            className="rounded border border-ink-500 bg-white px-2 py-1 text-sm"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {!user && <span className="text-xs text-fg-muted">제출하려면 로그인하세요</span>}
        </div>

        <div className="mt-3">
          <Suspense
            fallback={
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="h-[420px] w-full resize-none rounded border border-ink-500 bg-white p-4 font-mono text-sm leading-relaxed outline-none focus:border-[var(--color-brand)]"
              />
            }
          >
            <CodeEditor value={code} onChange={setCode} mode={language} heightClass="h-[420px]" />
          </Suspense>
        </div>

        {error && <p className="mt-2 text-xs text-[var(--color-wa)]">{error}</p>}

        <button
          onClick={onSubmit}
          disabled={!user || submitting}
          className="mt-3 w-full rounded bg-[var(--color-brand)] py-2 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-50"
        >
          {submitting ? '제출 중...' : '제출'}
        </button>
      </div>

      <div className="lg:col-span-2">
        <ProblemComments problemId={problem.id} />
      </div>
    </div>
  );
}
