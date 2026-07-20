import type { CommunityPostType } from '../api/types';

// 공지=붉은색, 업데이트 로그=푸른색, 일반=기본색.
export function postTitleColorClass(type: CommunityPostType): string {
  if (type === 'NOTICE') return 'text-[var(--color-wa)]';
  if (type === 'UPDATE_LOG') return 'text-[var(--color-brand)]';
  return 'text-fg';
}

const TYPE_LABEL: Record<Exclude<CommunityPostType, 'NORMAL'>, string> = {
  NOTICE: '공지',
  UPDATE_LOG: '업데이트',
};

/** 공지/업데이트 로그일 때만 앞에 붙는 작은 뱃지(일반 글은 아무것도 안 그림). */
export function PostTypeBadge({ type }: { type: CommunityPostType }) {
  if (type === 'NORMAL') return null;
  const isNotice = type === 'NOTICE';
  return (
    <span
      className={`mr-1.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
        isNotice
          ? 'bg-[var(--color-wa)]/10 text-[var(--color-wa)]'
          : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
      }`}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}
