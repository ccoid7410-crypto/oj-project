-- 실명(name) 컬럼 추가. 기존 계정은 NULL이며 로그인 후 앱에서 등록을 강제한다.
ALTER TABLE "users" ADD COLUMN "name" TEXT;
