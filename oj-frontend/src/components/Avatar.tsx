import { avatarUrl } from '../lib/avatar';

/** 프로필 이미지. 업로드한 이미지가 없으면 기본(회색) 원을 그린다. */
export function Avatar({
  username,
  avatarVersion,
  size = 40,
}: {
  username: string;
  avatarVersion: number | null;
  size?: number;
}) {
  const url = avatarUrl(username, avatarVersion);
  if (!url) {
    return (
      <span
        aria-hidden
        className="inline-block shrink-0 rounded-full bg-ink-500"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <img
      src={url}
      alt={`${username} 프로필 이미지`}
      width={size}
      height={size}
      className="inline-block shrink-0 rounded-full border border-ink-600 object-cover"
      style={{ width: size, height: size }}
    />
  );
}
