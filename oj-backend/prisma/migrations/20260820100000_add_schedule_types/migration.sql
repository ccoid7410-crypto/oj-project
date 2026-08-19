-- 일정 종류에 행사 및 축제, 기타를 추가한다.
ALTER TYPE "ClubScheduleType" ADD VALUE IF NOT EXISTS 'EVENT';
ALTER TYPE "ClubScheduleType" ADD VALUE IF NOT EXISTS 'OTHER';
