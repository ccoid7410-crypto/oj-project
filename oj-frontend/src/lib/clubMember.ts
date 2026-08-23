import type { Role } from '../api/types';

/**
 * 동아리 부원으로 취급하는 역할. 백엔드(common/club-member.ts)와 같은 목록이어야 한다.
 * 역할 하나가 권한 등급과 동아리 소속을 같이 나타내는 구조라, 부원에게 DEV를 주면
 * 부원 자격까지 사라지는 문제가 있었다. DEV는 동아리 개발 담당이라 부원으로 친다.
 */
export const CLUB_MEMBER_ROLES: Role[] = ['MEMBER', 'DEV', 'ADMIN'];

export function isClubMember(role?: Role | null): boolean {
  return !!role && CLUB_MEMBER_ROLES.includes(role);
}
