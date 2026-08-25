import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { Avatar } from '../../components/Avatar';

// club-homepage/js/notifications.js(알림 페이지 부분)의 React 버전.
// OJ 자체 /notifications(NotificationsPage.tsx)와 API·데이터 모양은 같지만,
// 사용자가 "분리가 목적"이라고 확인해줘서 라우트/컴포넌트를 별도로 둔다.

type NotificationType = 'REPORT_RECEIVED' | 'REPORT_RESOLVED' | 'MENTION' | 'ADMIN_MESSAGE';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  sender: string;
  /** 보낸 사람이 실제 계정이면 그 아이디, 시스템 발신이면 null. */
  senderUsername: string | null;
  senderAvatarVersion: number | null;
  linkUrl: string;
  read: boolean;
  createdAt: string;
}

type NotificationDetail = NotificationItem & { body: string };

const TYPE_LABEL: Record<NotificationType, string> = {
  REPORT_RECEIVED: '신고 접수',
  REPORT_RESOLVED: '신고 처리',
  MENTION: '멘션',
  ADMIN_MESSAGE: '관리자 알림',
};

function Sender({ item }: { item: NotificationItem }) {
  if (!item.senderUsername) return <>{item.sender}</>;
  return (
    <Link
      to={`/users/${item.senderUsername}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 align-[-3px] hover:text-[var(--color-brand)]"
    >
      <Avatar username={item.senderUsername} avatarVersion={item.senderAvatarVersion} size={16} />
      {item.senderUsername}
    </Link>
  );
}

function TypeChip({ type }: { type: NotificationType }) {
  return (
    <span className="shrink-0 rounded bg-[var(--color-brand)]/10 px-1.5 py-0.5 text-[11px] font-bold text-[var(--color-brand)]">
      {TYPE_LABEL[type]}
    </span>
  );
}

export function ClubNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.get<NotificationItem[]>('/notifications'));
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '알림을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markAllRead = async () => {
    await api.post('/notifications/read-all', {});
    window.dispatchEvent(new CustomEvent('user-notifications-updated'));
    await load();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">알림</h2>
        {items.some((n) => !n.read) && (
          <button
            type="button"
            onClick={markAllRead}
            className="rounded border border-ink-500 px-2 py-1 text-xs hover:border-[var(--color-brand)]"
          >
            모두 읽음
          </button>
        )}
      </div>

      {loading && <p className="mt-4 text-sm text-fg-muted">불러오는 중...</p>}
      {error && <p className="mt-4 text-sm text-[var(--color-wa)]">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="mt-4 text-sm text-fg-muted">아직 받은 알림이 없습니다.</p>
      )}

      <ul className="mt-3 border-t border-ink-600">
        {items.map((n) => (
          <li key={n.id} className="border-b border-ink-600">
            <Link
              to={`/home/notifications/${n.id}`}
              className={`block px-2 py-3 hover:bg-[var(--color-page-bg)] ${
                n.read ? '' : 'border-l-[3px] border-[var(--color-brand)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <TypeChip type={n.type} />
                <span className={`text-sm ${n.read ? '' : 'font-bold'}`}>{n.title}</span>
              </div>
              <div className="mt-1 text-xs text-fg-muted">
                <Sender item={n} /> · {new Date(n.createdAt).toLocaleString('ko-KR')}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClubNotificationDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<NotificationDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .get<NotificationDetail>(`/notifications/${id}`)
      .then((n) => {
        setItem(n);
        // 읽음 처리됐으니 헤더 뱃지를 갱신한다.
        window.dispatchEvent(new CustomEvent('user-notifications-updated'));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : '알림을 찾을 수 없습니다.'));
  }, [id]);

  if (error) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!item) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/home/notifications" className="text-xs text-fg-muted hover:text-[var(--color-brand)]">
        ← 알림
      </Link>
      <div className="mt-3 flex items-center gap-2">
        <TypeChip type={item.type} />
        <h2 className="text-lg font-bold">{item.title}</h2>
      </div>
      <p className="mt-1 text-xs text-fg-muted">
        <Sender item={item} /> · {new Date(item.createdAt).toLocaleString('ko-KR')}
      </p>
      {item.body && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{item.body}</p>}
      {item.linkUrl && (
        <a
          href={item.linkUrl}
          className="mt-5 inline-block rounded bg-[var(--color-brand)] px-3 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)]"
        >
          관련 내용 보러 가기
        </a>
      )}
    </div>
  );
}
