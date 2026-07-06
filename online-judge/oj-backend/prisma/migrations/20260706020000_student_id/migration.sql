-- 학번 필드 + 동아리 학번 명단 + 학번 수정 허용 기간

ALTER TABLE "users" ADD COLUMN "studentId" TEXT;

CREATE TABLE "club_roster" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "club_roster_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "club_roster_studentId_key" ON "club_roster"("studentId");

CREATE TABLE "student_id_edit_window" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "student_id_edit_window_pkey" PRIMARY KEY ("id")
);
