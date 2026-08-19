-- 동아리 홈페이지 수행평가/시험 일정

CREATE TYPE "ClubScheduleType" AS ENUM ('ASSESSMENT', 'EXAM');

CREATE TABLE "club_schedules" (
    "id" TEXT NOT NULL,
    "type" "ClubScheduleType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "subject" VARCHAR(80) NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "examScope" TEXT NOT NULL DEFAULT '',
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "club_schedules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "club_schedules_date_order_check" CHECK ("endsOn" >= "startsOn")
);

CREATE INDEX "club_schedules_startsOn_endsOn_idx" ON "club_schedules"("startsOn", "endsOn");

ALTER TABLE "club_schedules" ADD CONSTRAINT "club_schedules_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "club_schedules" ADD CONSTRAINT "club_schedules_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
