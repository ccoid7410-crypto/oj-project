-- 정기적인 토요휴업일은 일정표에 표시하지 않는다.
DELETE FROM "club_schedules"
WHERE "title" = '토요휴업일';
