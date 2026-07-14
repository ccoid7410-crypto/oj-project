import { API_URL } from '../api/client';

export function avatarUrl(username: string, avatarVersion: number | null): string | null {
  if (avatarVersion == null) return null;
  // ?v=버전 덕분에 서버가 이미지를 immutable로 오래 캐시시켜도 교체 즉시 반영된다.
  return `${API_URL}/users/${encodeURIComponent(username)}/avatar?v=${avatarVersion}`;
}

const AVATAR_EDGE = 256; // 서버/DB 부담을 줄이기 위해 업로드 전에 여기까지 축소한다

/**
 * 선택한 이미지 파일을 정사각형(cover 크롭) AVATAR_EDGE px로 축소해
 * 업로드 요청 바디({ mime, data(base64) })로 변환한다.
 */
export async function fileToAvatarPayload(file: File): Promise<{ mime: string; data: string }> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('이미지 파일을 읽을 수 없습니다.');
  });
  try {
    const edge = Math.min(AVATAR_EDGE, bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = edge;
    canvas.height = edge;
    const ctx = canvas.getContext('2d')!;
    // 중앙 기준 정사각형 크롭 후 축소
    const srcEdge = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - srcEdge) / 2;
    const sy = (bitmap.height - srcEdge) / 2;
    ctx.drawImage(bitmap, sx, sy, srcEdge, srcEdge, 0, 0, edge, edge);

    // 투명도를 보존하는 PNG로 내보낸다. 256px라 용량도 충분히 작다(수십 KB).
    const dataUrl = canvas.toDataURL('image/png');
    const [, data] = dataUrl.split(',', 2);
    return { mime: 'image/png', data };
  } finally {
    bitmap.close();
  }
}
