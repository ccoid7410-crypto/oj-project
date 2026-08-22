-- 부원이 직접 만드는 일정 종류. type=CUSTOM이고 실제 이름은 customType에 담는다.
ALTER TYPE "ClubScheduleType" ADD VALUE IF NOT EXISTS 'CUSTOM';

ALTER TABLE "club_schedules"
  ADD COLUMN IF NOT EXISTS "customType" VARCHAR(20) NOT NULL DEFAULT '';
