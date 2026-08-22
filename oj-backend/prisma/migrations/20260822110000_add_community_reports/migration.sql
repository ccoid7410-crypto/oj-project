-- 커뮤니티 게시글·댓글 신고
CREATE TYPE "ReportTargetType" AS ENUM ('POST', 'COMMENT');
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'ABUSE', 'ADULT', 'PRIVACY', 'FALSE_INFO', 'ETC');
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'ACTION_TAKEN', 'DISMISSED');

CREATE TABLE "community_reports" (
    "id" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "detail" VARCHAR(1000) NOT NULL DEFAULT '',
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reporterId" TEXT NOT NULL,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "handlerNote" VARCHAR(500) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "community_reports_reporterId_targetType_targetId_key"
  ON "community_reports"("reporterId", "targetType", "targetId");
CREATE INDEX "community_reports_status_createdAt_idx"
  ON "community_reports"("status", "createdAt");

ALTER TABLE "community_reports"
  ADD CONSTRAINT "community_reports_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_reports"
  ADD CONSTRAINT "community_reports_handledById_fkey"
  FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
