import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { ProblemDetail } from '../api/types';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { useAuth } from '../context/AuthContext';
import { loginHint } from '../components/AccessGate';
import { labelOfLevel, LEVEL_MAX, LEVEL_MIN } from '../lib/difficulty';
import { ProblemComments } from '../components/ProblemComments';
import { ProblemTypeBadge } from '../components/ProblemTypeBadge';

// KaTeX(수식) 번들이 커서 문제 페이지에서만 lazy load 한다.
const MarkdownView = lazy(() =>
  import('../components/MarkdownView').then((m) => ({ default: m.MarkdownView })),
);

/**
 * 문제 상세: 설명·제한·예제·댓글만 보여준다. 코드 제출은 별도 화면(`SubmitPage`,
 * `/problems/:slug/submit`)으로 분리돼 있다 - 예전엔 여기 인라인 에디터가 있었다.
 */
export function ProblemDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const contestId = searchParams.get('contestId');

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
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

  useEffect(loadProblem, [slug, contestId]);

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

  if (error && !problem) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!problem) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  const submitLink = `/problems/${problem.slug}/submit${contestId ? `?contestId=${contestId}` : ''}`;

  return (
    <div>
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
          <ProblemTypeBadge type={problem.problemType} isPractice={problem.isPractice} />
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

        {problem.problemType !== 'STANDARD' && (
          <p className="mt-3 rounded border border-[var(--color-brand)]/40 bg-ink-700 p-3 text-xs text-fg-muted">
            {problem.problemType === 'SCORING'
              ? `정확도형 문제입니다. ${
                  problem.scoringMode === 'TARGET'
                    ? '기준값에 가까울수록'
                    : problem.scoringMode === 'MAXIMIZE'
                      ? '출력값이 클수록'
                      : '출력값이 작을수록'
                } 높은 점수를 받으며 만점은 ${problem.maxScore}점입니다.`
              : '인터랙티브형 문제입니다. 채점기가 입력의 각 줄을 순서대로 보내고, 프로그램은 매 요청마다 한 줄을 출력하고 즉시 flush해야 합니다.'}
          </p>
        )}
        {problem.isPractice && (
          <p className="mt-2 text-xs text-fg-muted">연습 문제의 정답 제출은 프로필 레이팅에 반영되지 않습니다.</p>
        )}

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
                <h3 className="border-b border-ink-500 pb-1 text-sm font-bold">
                  {problem.problemType === 'INTERACTIVE' ? '예제 요청' : '예제 입력'} {i + 1}
                </h3>
                <pre className="mt-2 rounded border border-ink-600 bg-ink-700 p-3 font-mono text-xs">{tc.input}</pre>
                <h3 className="mt-3 border-b border-ink-500 pb-1 text-sm font-bold">
                  {problem.problemType === 'INTERACTIVE' ? '예제 응답' : '예제 출력'} {i + 1}
                </h3>
                <pre className="mt-2 rounded border border-ink-600 bg-ink-700 p-3 font-mono text-xs">{tc.output}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-ink-600 pt-4">
        {user ? (
          <Link
            to={submitLink}
            className="rounded bg-[var(--color-brand)] px-5 py-2.5 font-bold text-white hover:bg-[var(--color-brand-dim)]"
          >
            제출하기
          </Link>
        ) : (
          <span className="text-xs text-fg-muted">{loginHint('제출')}</span>
        )}
        <Link
          to="/submissions/me"
          className="rounded border border-ink-500 px-5 py-2.5 font-bold text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
        >
          내 제출
        </Link>
        <Link
          to="/problems"
          className="ml-auto rounded border border-ink-500 px-5 py-2.5 font-bold text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
        >
          목록으로
        </Link>
      </div>

      <div className="mt-8">
        <ProblemComments problemId={problem.id} contestId={contestId} />
      </div>
    </div>
  );
}
