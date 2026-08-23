-- 사용자 알림(헤더 종 아이콘)
CREATE TYPE "UserNotificationType" AS ENUM ('REPORT_RECEIVED', 'REPORT_RESOLVED', 'MENTION', 'ADMIN_MESSAGE');

CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserNotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "sender" VARCHAR(60) NOT NULL DEFAULT 'Durunuri OJ',
    "linkUrl" VARCHAR(500) NOT NULL DEFAULT '',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_notifications_userId_readAt_createdAt_idx"
  ON "user_notifications"("userId", "readAt", "createdAt");

ALTER TABLE "user_notifications"
  ADD CONSTRAINT "user_notifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
