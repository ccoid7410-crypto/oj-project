-- 계정 정지 필드 + 관리자 알림 테이블

ALTER TABLE "users" ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "bannedReason" TEXT;
ALTER TABLE "users" ADD COLUMN "bannedAt" TIMESTAMP(3);

CREATE TABLE "admin_notifications" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "problemId" TEXT,
  "voterId" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "admin_notifications"
  ADD CONSTRAINT "admin_notifications_problemId_fkey"
  FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_notifications"
  ADD CONSTRAINT "admin_notifications_voterId_fkey"
  FOREIGN KEY ("voterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
