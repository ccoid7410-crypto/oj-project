-- 일정 제안 승인 흐름 + 반 태그

CREATE TYPE "ClubScheduleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "club_schedules"
  ADD COLUMN "status" "ClubScheduleStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "classTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" VARCHAR(500) NOT NULL DEFAULT '';

-- 기존 일정은 그대로 공개하고, 이 마이그레이션 이후 새 제안만 승인 대기로 저장한다.
ALTER TABLE "club_schedules" ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE INDEX "club_schedules_status_createdAt_idx" ON "club_schedules"("status", "createdAt");

ALTER TABLE "club_schedules" ADD CONSTRAINT "club_schedules_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
