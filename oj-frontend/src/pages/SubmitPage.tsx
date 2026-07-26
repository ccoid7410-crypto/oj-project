import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Language, ProblemDetail } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_TEMPLATE, LANGUAGE_OPTIONS } from '../lib/languages';

// Ace 에디터 번들이 커서 필요할 때만 lazy load 한다(문제 상세 페이지와 동일한 패턴).
const CodeEditor = lazy(() =>
  import('../components/CodeEditor').then((m) => ({ default: m.CodeEditor })),
);

/**
 * 문제 상세와 분리된 코드 제출 화면.
 * 예전엔 이 로직이 ProblemDetailPage에 인라인으로 박혀 있었는데(별도 라우트 없이 같은
 * 페이지에서 바로 제출), 디자인 핸드오프가 "문제상세 → 제출 화면 → 채점현황" 흐름을
 * 별도 화면으로 요구해서 이 페이지로 분리했다.
 */
export function SubmitPage() {
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

  useEffect(() => {
    if (!slug) return;
    api
      .get<ProblemDetail>(`/problems/${slug}${contestId ? `?contestId=${contestId}` : ''}`)
      .then((p) => {
        setProblem(p);
        if (p.allowedLanguages.length > 0 && !p.allowedLanguages.includes('CPP')) {
          const next = p.allowedLanguages[0];
          setLanguage(next);
          setCode(DEFAULT_TEMPLATE[next]);
        }
      })
      .catch(() => setError('문제를 불러오지 못했습니다.'));
  }, [slug, contestId]);

  // 프로필에 설정한 기본 제출 언어를 자동 선택한다(문제 상세 페이지와 동일한 정책).
  useEffect(() => {
    if (!user?.preferredLanguage || !problem) return;
    if (problem.allowedLanguages.length > 0 && !problem.allowedLanguages.includes(user.preferredLanguage)) return;
    onLanguageChange(user.preferredLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.preferredLanguage, problem]);

  function onLanguageChange(next: Language) {
    setLanguage(next);
    // 아직 직접 코드를 안 건드렸으면 템플릿도 같이 바꿔줌
    setCode((prev) => (Object.values(DEFAULT_TEMPLATE).includes(prev) ? DEFAULT_TEMPLATE[next] : prev));
  }

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
      // 제출 직후 채점 현황(실시간 채점 결과 화면)으로 이동.
      navigate(`/submissions/${submission.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !problem) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!problem) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  const availableLanguages = LANGUAGE_OPTIONS.filter(
    (opt) => problem.allowedLanguages.length === 0 || problem.allowedLanguages.includes(opt.value),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">
        제출: {problem.displayId}번 {problem.title}
      </h1>
      <p className="mt-1 text-xs text-fg-muted">
        언어를 고르고 소스 코드를 붙여넣은 뒤 제출합니다. 제출 후 채점 현황으로 이동합니다.
      </p>

      <table className="mt-4 w-full border-collapse text-left text-[13px]">
        <tbody>
          <tr>
            <th className="w-[120px] border border-ink-600 bg-ink-700 px-3 py-2 font-medium text-fg-muted">
              문제
            </th>
            <td className="border border-ink-600 px-3 py-2">
              <Link to={`/problems/${problem.slug}`} className="text-[var(--color-brand)] hover:underline">
                {problem.displayId}. {problem.title}
              </Link>
              <span className="ml-2 text-fg-muted">
                시간 제한 {problem.timeLimitMs}ms · 메모리 제한 {problem.memoryLimitMb}MB
              </span>
            </td>
          </tr>
          <tr>
            <th className="border border-ink-600 bg-ink-700 px-3 py-2 font-medium text-fg-muted">언어</th>
            <td className="border border-ink-600 px-3 py-2">
              <div className="flex flex-wrap gap-1.5">
                {availableLanguages.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onLanguageChange(opt.value)}
                    className={`rounded px-3 py-1 text-xs font-bold ${
                      language === opt.value
                        ? 'bg-[var(--color-brand)] text-white'
                        : 'border border-ink-500 text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-4">
        <Suspense
          fallback={
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="h-[280px] w-full resize-y rounded border border-ink-500 bg-ink-800 p-4 font-mono text-xs leading-relaxed outline-none focus:border-[var(--color-brand)]"
            />
          }
        >
          <CodeEditor value={code} onChange={setCode} mode={language} heightClass="h-[280px]" />
        </Suspense>
      </div>

      {error && <p className="mt-2 text-xs text-[var(--color-wa)]">{error}</p>}

      <div className="mt-4 flex items-center gap-2 border-t border-ink-600 pt-4">
        <button
          onClick={onSubmit}
          disabled={!user || submitting}
          className="rounded bg-[var(--color-brand)] px-5 py-2.5 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-50"
        >
          {submitting ? '제출 중...' : '제출'}
        </button>
        <Link
          to={`/problems/${problem.slug}${contestId ? `?contestId=${contestId}` : ''}`}
          className="rounded border border-ink-500 px-5 py-2.5 font-bold text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
        >
          문제로 돌아가기
        </Link>
        {!user && <span className="ml-2 text-xs text-fg-muted">제출하려면 로그인하세요</span>}
      </div>
    </div>
  );
}
