import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { AdminNotification } from '../../api/types';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<AdminNotification[]>('/admin/notifications')
      .then(setNotifications)
      .catch(() => setError('알림을 불러오지 못했습니다.'));
  }

  useEffect(load, []);

  async function markRead(id: string) {
    await api.post(`/admin/notifications/${id}/read`);
    load();
    window.dispatchEvent(new Event('notifications-updated'));
  }

  async function markAllRead() {
    await api.post('/admin/notifications/read-all');
    load();
    window.dispatchEvent(new Event('notifications-updated'));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg-muted">난이도 투표가 기존 난이도와 크게 어긋날 때 여기에 쌓입니다.</p>
        {notifications && notifications.some((n) => !n.read) && (
          <button
            onClick={markAllRead}
            className="rounded border border-ink-500 px-3 py-1 text-xs hover:border-[var(--color-brand)]"
          >
            모두 읽음 처리
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-[var(--color-wa)]">{error}</p>}
      {notifications && notifications.length === 0 && (
        <p className="mt-8 text-sm text-fg-muted">알림이 없습니다.</p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {notifications?.map((n) => (
          <li
            key={n.id}
            className={`rounded border p-3 text-sm ${
              n.read ? 'border-ink-600 text-fg-muted' : 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={n.read ? '' : 'font-medium text-fg'}>{n.message}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-fg-muted">
                  {new Date(n.createdAt).toLocaleString('ko-KR')}
                  {n.problem && (
                    <Link to={`/problems/${n.problem.slug}`} className="text-[var(--color-brand)] hover:underline">
                      문제 보기
                    </Link>
                  )}
                  {n.voter && (
                    <Link to={`/users/${n.voter.username}`} className="text-[var(--color-brand)] hover:underline">
                      투표자 프로필
                    </Link>
                  )}
                </p>
              </div>
              {!n.read && (
                <button
                  onClick={() => markRead(n.id)}
                  className="shrink-0 rounded border border-ink-500 px-2 py-1 text-xs hover:border-[var(--color-brand)]"
                >
                  읽음
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
