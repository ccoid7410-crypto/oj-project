import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

type ReportStatus = 'PENDING' | 'ACTION_TAKEN' | 'DISMISSED';
type ReportTargetType = 'POST' | 'COMMENT';
type ReportReason = 'SPAM' | 'ABUSE' | 'ADULT' | 'PRIVACY' | 'FALSE_INFO' | 'ETC';

type ReportTarget = {
  exists: boolean;
  board: string | null;
  postId: string | null;
  title: string | null;
  content: string;
  authorUsername: string | null;
  isReply: boolean;
};

type Report = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail: string;
  status: ReportStatus;
  reporter: string | null;
  handledBy: string | null;
  handledAt: string | null;
  handlerNote: string;
  createdAt: string;
  target: ReportTarget;
};

const REASON_LABEL: Record<ReportReason, string> = {
  SPAM: '스팸·광고',
  ABUSE: '욕설·비방',
  ADULT: '음란물·부적절한 내용',
  PRIVACY: '개인정보 노출',
  FALSE_INFO: '허위 정보',
  ETC: '기타',
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: '처리 대기',
  ACTION_TAKEN: '조치함',
  DISMISSED: '기각',
};

const BOARD_LABEL: Record<string, string> = {
  OJ: 'OJ 커뮤니티',
  HOME: '공개 게시판',
  CLUB: '동아리 게시판',
};

const TABS: { value: ReportStatus | 'ALL'; label: string }[] = [
  { value: 'PENDING', label: '처리 대기' },
  { value: 'ACTION_TAKEN', label: '조치함' },
  { value: 'DISMISSED', label: '기각' },
  { value: 'ALL', label: '전체' },
];

function targetLabel(report: Report) {
  if (report.targetType === 'POST') return '게시글';
  return report.target.isReply ? '답글' : '댓글';
}

export function ReportsAdminPage() {
  const [tab, setTab] = useState<ReportStatus | 'ALL'>('PENDING');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = tab === 'ALL' ? '' : `?status=${tab}`;
      setReports(await api.get<Report[]>(`/community/reports${query}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '신고 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (report: Report, action: 'DELETE_TARGET' | 'DISMISS') => {
    const confirmText =
      action === 'DELETE_TARGET'
        ? `신고된 ${targetLabel(report)}을(를) 삭제할까요? 되돌릴 수 없습니다.`
        : '이 신고를 기각할까요?';
    if (!window.confirm(confirmText)) return;
    setBusyId(report.id);
    try {
      await api.post(`/community/reports/${report.id}/resolve`, {
        action,
        note: notes[report.id] ?? '',
      });
      window.dispatchEvent(new CustomEvent('reports-updated'));
      await load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : '신고를 처리하지 못했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold">신고 관리</h2>
      <p className="mt-1 text-xs text-fg-muted">
        커뮤니티 게시글·댓글 신고를 확인하고 처리합니다. 삭제하면 해당 글이 실제로 지워지고,
        같은 대상에 걸린 다른 신고도 함께 정리됩니다.
      </p>

      <div className="mt-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded border px-3 py-1.5 text-xs ${
              tab === t.value
                ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 font-bold text-[var(--color-brand)]'
                : 'border-ink-500 text-fg-muted hover:border-[var(--color-brand)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-4 text-sm text-fg-muted">불러오는 중...</p>}
      {error && <p className="mt-4 text-sm text-[var(--color-wa)]">{error}</p>}
      {!loading && !error && reports.length === 0 && (
        <p className="mt-4 text-sm text-fg-muted">해당하는 신고가 없습니다.</p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {reports.map((r) => (
          <article key={r.id} className="rounded border border-ink-500 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <span className="rounded bg-[var(--color-brand)]/10 px-2 py-0.5 font-bold text-[var(--color-brand)]">
                {REASON_LABEL[r.reason]}
              </span>
              <span>{targetLabel(r)}</span>
              {r.target.board && <span>· {BOARD_LABEL[r.target.board] ?? r.target.board}</span>}
              <span>· 신고자 {r.reporter ?? '(탈퇴)'}</span>
              <span>· {new Date(r.createdAt).toLocaleString('ko-KR')}</span>
              <span className="ml-auto font-bold">{STATUS_LABEL[r.status]}</span>
            </div>

            {r.detail && <p className="mt-2 text-sm">{r.detail}</p>}

            <div className="mt-3 rounded border border-ink-600 bg-[var(--color-page-bg)] p-3 text-sm">
              {r.target.exists ? (
                <>
                  <div className="text-xs text-fg-muted">
                    작성자 {r.target.authorUsername ?? '(탈퇴)'}
                    {r.target.title && ` · 글: ${r.target.title}`}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words">{r.target.content}</p>
                </>
              ) : (
                <p className="text-fg-muted">신고 대상이 이미 삭제되었습니다.</p>
              )}
            </div>

            {r.status === 'PENDING' ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="처리 메모 (선택)"
                  maxLength={500}
                  className="flex-1 rounded border border-ink-500 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-brand)]"
                />
                <button
                  type="button"
                  disabled={busyId === r.id || !r.target.exists}
                  onClick={() => resolve(r, 'DELETE_TARGET')}
                  className="rounded bg-[var(--color-wa)] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  삭제 조치
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => resolve(r, 'DISMISS')}
                  className="rounded border border-ink-500 px-3 py-1.5 text-sm hover:border-[var(--color-brand)] disabled:opacity-50"
                >
                  기각
                </button>
              </div>
            ) : (
              <div className="mt-3 text-xs text-fg-muted">
                {r.handledBy && `${r.handledBy} 처리`}
                {r.handledAt && ` · ${new Date(r.handledAt).toLocaleString('ko-KR')}`}
                {r.handlerNote && ` · ${r.handlerNote}`}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
