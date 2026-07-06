-- 난이도 세분화(레벨 1~30) + DIAMOND/RUBY 티어 추가 + 난이도 투표 테이블 + 레이팅 기본값 변경

ALTER TYPE "Difficulty" ADD VALUE IF NOT EXISTS 'DIAMOND';
ALTER TYPE "Difficulty" ADD VALUE IF NOT EXISTS 'RUBY';

ALTER TABLE "problems" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;

-- 기존 문제는 세부 레벨 정보가 없으니, 굵은 티어의 가운데 값으로 채워둔다.
UPDATE "problems" SET "level" = CASE "difficulty"
  WHEN 'BRONZE' THEN 3
  WHEN 'SILVER' THEN 8
  WHEN 'GOLD' THEN 13
  WHEN 'PLATINUM' THEN 18
  ELSE 1
END;

CREATE TABLE "problem_difficulty_votes" (
  "problemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "problem_difficulty_votes_pkey" PRIMARY KEY ("problemId", "userId")
);

ALTER TABLE "problem_difficulty_votes"
  ADD CONSTRAINT "problem_difficulty_votes_problemId_fkey"
  FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "problem_difficulty_votes"
  ADD CONSTRAINT "problem_difficulty_votes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users" ALTER COLUMN "rating" SET DEFAULT 0;
