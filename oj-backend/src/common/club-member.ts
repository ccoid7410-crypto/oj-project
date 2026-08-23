/**
 * 동아리 부원으로 취급하는 역할.
 *
 * 역할 하나가 "권한 등급"과 "동아리 소속"을 같이 나타내는 구조라, 부원에게 DEV를 주면
 * 부원 자격까지 같이 사라진다(명예의 전당에서 빠지고, 동아리 게시판·문제 등록도 막힌다).
 * DEV는 동아리 개발 담당이라 부원이 맞으므로 여기에 포함한다.
 * TEACHER는 선생님이라 부원이 아니므로 제외한다.
 */
export const CLUB_MEMBER_ROLES = ['MEMBER', 'DEV', 'ADMIN'] as const;

export function isClubMember(role?: string | null): boolean {
  return (CLUB_MEMBER_ROLES as readonly string[]).includes(role ?? '');
}
