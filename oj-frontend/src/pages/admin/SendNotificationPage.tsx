import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';

/** 관리자가 사용자들에게 직접 알림을 보내는 화면. */
export function SendNotificationPage() {
  const [usernames, setUsernames] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; notFound: string[] } | null>(null);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // 쉼표·공백·줄바꿈 아무거나로 구분해서 받는다.
    const list = [...new Set(usernames.split(/[\s,]+/).filter(Boolean))];
    if (list.length === 0 || !title.trim()) {
      setError('받는 사람과 제목을 입력해주세요.');
      return;
    }
    setSending(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post<{ sent: number; notFound: string[] }>('/notifications/send', {
        usernames: list,
        title: title.trim(),
        body,
        linkUrl: linkUrl.trim(),
      });
      setResult(res);
      if (res.sent > 0) {
        setTitle('');
        setBody('');
        setLinkUrl('');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '알림을 보내지 못했습니다.');
    } finally {
      setSending(false);
    }
  };

  const inputClass =
    'rounded border border-ink-500 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-brand)]';

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold">알림 보내기</h2>
      <p className="mt-1 text-xs text-fg-muted">
        선택한 사용자들의 알림함으로 바로 전달됩니다. 보낸 사람은 관리자 아이디로 표시됩니다.
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>받는 사람 (아이디, 쉼표나 줄바꿈으로 구분)</span>
          <textarea
            rows={3}
            value={usernames}
            onChange={(e) => setUsernames(e.target.value)}
            placeholder="alice, bob"
            className={`${inputClass} resize-y font-mono`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>제목</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>내용</span>
          <textarea
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            className={`${inputClass} resize-y`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>연결 링크 (선택)</span>
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="/problems/1000"
            maxLength={500}
            className={inputClass}
          />
        </label>

        {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}
        {result && (
          <p className="text-xs text-fg-muted">
            {result.sent}명에게 보냈습니다.
            {result.notFound.length > 0 && ` (없는 아이디: ${result.notFound.join(', ')})`}
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={sending}
            className="rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
          >
            {sending ? '보내는 중...' : '보내기'}
          </button>
        </div>
      </form>
    </div>
  );
}
