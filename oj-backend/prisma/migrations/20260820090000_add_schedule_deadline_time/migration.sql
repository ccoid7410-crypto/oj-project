-- 수행평가의 날짜별 마감 시각(HH:mm)
ALTER TABLE "club_schedules"
  ADD COLUMN "deadlineTime" VARCHAR(5) NOT NULL DEFAULT '';
