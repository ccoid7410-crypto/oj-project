-- 비밀번호 변경 전 JWT를 즉시 폐기하기 위한 버전과, username 재사용 공격에 영향받지 않는
-- 메인 관리자 표식을 추가한다.
ALTER TABLE "users"
  ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isRootAdmin" BOOLEAN NOT NULL DEFAULT false;

-- 기존 배포의 메인 관리자 행을 한 번만 승격한다. 이후 같은 username으로 새 계정을 만들어도
-- 이 표식은 자동으로 따라가지 않는다.
UPDATE "users" SET "isRootAdmin" = true WHERE "username" = 'jihun1050';

-- 실수나 직접 DB 수정으로 메인 관리자 행이 둘 이상 생기는 것을 DB 수준에서 막는다.
CREATE UNIQUE INDEX "users_single_root_admin" ON "users" ("isRootAdmin") WHERE "isRootAdmin" = true;
