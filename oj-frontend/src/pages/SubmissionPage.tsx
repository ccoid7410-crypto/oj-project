import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { SubmissionDetail } from '../api/types';
import { VerdictBadge } from '../components/VerdictBadge';
import { subscribeToSubmission } from '../lib/socket';

export function SubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);

  const refetch = useCallback(() => {
    if (!id) return;
    api.get<SubmissionDetail>(`/submissions/${id}`).then(setSubmission);
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!id) return;
    return subscribeToSubmission(id, () => refetch());
  }, [id, refetch]);

  if (!submission) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  const isLive = submission.status === 'PENDING' || submission.status === 'JUDGING';

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">제출 결과</h1>
        <VerdictBadge status={submission.status} />
      </div>
      <p className="mt-1 text-xs text-fg-muted">
        {submission.language} · {new Date(submission.createdAt).toLocaleString('ko-KR')}
        {submission.runtimeMs != null && ` · ${submission.runtimeMs}ms`}
        {submission.memoryKb != null && ` · ${submission.memoryKb}KB`}
      </p>

      {/* 컴파일러 로그처럼 테스트케이스가 하나씩 판정되는 걸 보여줌 */}
      <div className="mt-6 rounded border border-ink-500 bg-white p-4 text-sm">
        {submission.testResults.length === 0 && isLive && (
          <p className="text-[var(--color-pending)]">
            <span className="pulse-dot mr-2 inline-block h-2 w-2 rounded-full bg-current" />
            채점 대기 중...
          </p>
        )}
        {submission.testResults.length === 0 && !isLive && submission.status === 'COMPILE_ERROR' && (
          <p className="text-[var(--color-ce)]">컴파일 실패 — 테스트케이스 실행 전에 중단됨</p>
        )}
        <ul className="divide-y divide-ink-600">
          {submission.testResults
            .sort((a, b) => a.testCase.order - b.testCase.order)
            .map((tr, i) => (
              <li key={tr.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                <span className="text-fg-muted">
                  테스트 #{i + 1} {tr.testCase.isSample && <span className="text-xs">(예제)</span>}
                </span>
                <span className="flex items-center gap-3">
                  {tr.runtimeMs != null && <span className="text-fg-muted">{tr.runtimeMs}ms</span>}
                  <VerdictBadge status={tr.status} />
                </span>
              </li>
            ))}
        </ul>
        {isLive && submission.testResults.length > 0 && (
          <p className="mt-2 text-[var(--color-pending)]">
            <span className="pulse-dot mr-2 inline-block h-2 w-2 rounded-full bg-current" />
            다음 테스트케이스 채점 중...
          </p>
        )}
      </div>

      {submission.errorMessage && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-bold text-fg-muted">에러 출력</p>
          <pre className="whitespace-pre-wrap rounded border border-[var(--color-wa)]/30 bg-[var(--color-wa)]/5 p-3 font-mono text-xs text-[var(--color-wa)]">
            {submission.errorMessage}
          </pre>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-1 text-xs font-bold text-fg-muted">제출한 코드</p>
        <pre className="max-h-96 overflow-auto rounded border border-ink-500 bg-ink-700 p-4 font-mono text-xs leading-relaxed">
          {submission.sourceCode}
        </pre>
      </div>
    </div>
  );
}
