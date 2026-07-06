-- 문제 번호(displayId)를 BOJ처럼 1000번대부터 시작하는 고정 번호로 부여한다.
CREATE SEQUENCE IF NOT EXISTS "problems_displayId_seq" START WITH 1000;

ALTER TABLE "problems" ADD COLUMN "displayId" INTEGER NOT NULL DEFAULT nextval('"problems_displayId_seq"');

ALTER SEQUENCE "problems_displayId_seq" OWNED BY "problems"."displayId";

CREATE UNIQUE INDEX "problems_displayId_key" ON "problems"("displayId");
