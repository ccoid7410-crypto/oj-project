-- 동아리 게시판(부원 전용)용 board 값 추가. 기존 OJ/HOME 데이터는 그대로 유지된다.
ALTER TYPE "CommunityBoard" ADD VALUE IF NOT EXISTS 'CLUB';
