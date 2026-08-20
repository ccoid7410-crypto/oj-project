-- 방학식은 행사의 성격을 유지하고, 실제 방학 기간만 전용 색으로 분리한다.
UPDATE "club_schedules"
SET "type" = 'VACATION'
WHERE "title" LIKE '%방학';
