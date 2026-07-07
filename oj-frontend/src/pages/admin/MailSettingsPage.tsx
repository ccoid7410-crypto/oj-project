import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

type MailStatus = {
  configured: boolean;
  source: 'database' | 'environment' | 'log-only';
  provider: string;
  host: string | null;
  port: number | null;
  secure: boolean;
  from: string;
  user: string | null;
  ready: boolean;
  message: string;
};

type TestMailResult = {
  ok: boolean;
  message: string;
};

export function MailSettingsPage() {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [testTo, setTestTo] = useState('');
  const [from, setFrom] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const next = await api.get<MailStatus>('/admin/mail/status');
      setStatus(next);
      setFrom(next.from.includes('@') ? next.from : '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '메일 설정 상태를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function saveGmail() {
    if (!from.trim() || !smtpUser.trim()) return;
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const next = await api.put<MailStatus>('/admin/mail/gmail', {
        from: from.trim(),
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim() || undefined,
      });
      setStatus(next);
      setSmtpPass('');
      setResult(next.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gmail 설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function disableConfig() {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const next = await api.delete<MailStatus>('/admin/mail/config');
      setStatus(next);
      setResult('관리자 페이지에 저장된 메일 설정을 껐습니다.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '메일 설정을 끄지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!testTo.trim()) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<TestMailResult>('/admin/mail/test', { to: testTo.trim() });
      setResult(res.message);
      await loadStatus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '테스트 메일 발송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  }

  if (loading && !status) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">메일 설정</h2>
          <p className="mt-1 text-sm text-fg-muted">회원가입 인증 메일에 쓰는 기본 발신 계정 상태를 확인합니다.</p>
        </div>
        <button
          onClick={loadStatus}
          className="rounded border border-ink-500 px-3 py-1.5 text-xs hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
        >
          새로고침
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-[var(--color-wa)]">{error}</p>}

      {status && (
        <div className="mt-4 rounded border border-ink-500 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">{status.ready ? '사용 가능' : '확인 필요'}</p>
              <p className="mt-1 text-sm text-fg-muted">{status.message}</p>
            </div>
            <span
              className={`rounded px-2 py-1 text-xs font-bold ${
                status.ready ? 'bg-[var(--color-ac)] text-white' : 'bg-[var(--color-wa)] text-white'
              }`}
            >
              {status.configured ? status.provider.toUpperCase() : 'LOG ONLY'}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-fg-muted">설정 위치</dt>
              <dd className="mt-1 font-mono">
                {status.source === 'database' ? '관리자 페이지' : status.source === 'environment' ? '환경변수' : '로그 전용'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">발신 주소</dt>
              <dd className="mt-1 font-mono">{status.from}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">로그인 계정</dt>
              <dd className="mt-1 font-mono">{status.user ?? '없음'}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">SMTP 서버</dt>
              <dd className="mt-1 font-mono">{status.host ?? '미설정'}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">포트 / 보안</dt>
              <dd className="mt-1 font-mono">{status.port ? `${status.port} / ${status.secure ? 'SSL' : 'STARTTLS'}` : '미설정'}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="mt-4 rounded border border-ink-500 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">Gmail 저장</h3>
          <button
            onClick={disableConfig}
            disabled={saving || status?.source !== 'database'}
            className="rounded border border-ink-500 px-3 py-1.5 text-xs hover:border-[var(--color-wa)] hover:text-[var(--color-wa)] disabled:opacity-50"
          >
            저장 설정 끄기
          </button>
        </div>
        <p className="mt-2 text-xs text-fg-muted">
          Gmail은 일반 로그인 비밀번호를 받지 않습니다. Google 계정에서 2단계 인증을 켠 뒤 앱 비밀번호를 만들어 넣어야 합니다.
        </p>
        <div className="mt-3 grid gap-3">
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            발신 Gmail
            <input
              type="email"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                if (!smtpUser) setSmtpUser(e.target.value);
              }}
              placeholder="your-account@gmail.com"
              className="rounded border border-ink-500 px-3 py-2 text-sm text-fg outline-none focus:border-[var(--color-brand)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            SMTP 로그인 Gmail
            <input
              type="email"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="your-account@gmail.com"
              className="rounded border border-ink-500 px-3 py-2 text-sm text-fg outline-none focus:border-[var(--color-brand)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            Gmail 앱 비밀번호
            <input
              type="password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder={status?.source === 'database' ? '변경할 때만 새 앱 비밀번호 입력' : '16자리 앱 비밀번호'}
              className="rounded border border-ink-500 px-3 py-2 text-sm text-fg outline-none focus:border-[var(--color-brand)]"
            />
          </label>
        </div>
        <button
          onClick={saveGmail}
          disabled={saving || !from.trim() || !smtpUser.trim()}
          className="mt-3 rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {saving ? '저장 중...' : 'Gmail 설정 저장'}
        </button>
      </div>

      <div className="mt-4 rounded border border-ink-500 p-4">
        <h3 className="font-bold">테스트 메일</h3>
        <div className="mt-3 flex gap-2">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="받을 이메일"
            className="min-w-0 flex-1 rounded border border-ink-500 px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
          <button
            onClick={sendTest}
            disabled={sending || !testTo.trim()}
            className="rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
          >
            {sending ? '발송 중...' : '보내기'}
          </button>
        </div>
        {result && <p className="mt-2 text-sm text-[var(--color-ac)]">{result}</p>}
      </div>
    </div>
  );
}
