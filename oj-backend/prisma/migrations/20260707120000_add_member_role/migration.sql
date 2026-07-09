-- 동아리 부원(MEMBER) 권한 추가: USER와 ADMIN 사이 단계로, 홈페이지 접속 자격에 사용된다.
ALTER TYPE "Role" ADD VALUE 'MEMBER' BEFORE 'ADMIN';
