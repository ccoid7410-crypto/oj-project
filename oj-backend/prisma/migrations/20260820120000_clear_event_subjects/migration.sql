-- 행사 및 축제/기타 일정에는 과목을 사용하지 않는다.
UPDATE "club_schedules"
SET "subject" = ''
WHERE "type" IN ('EVENT', 'OTHER');
