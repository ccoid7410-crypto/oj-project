-- 1. 통계 필터용 가벼운 Group
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "groups_name_key" ON "groups"("name");

ALTER TABLE "users" ADD COLUMN "groupId" TEXT;
ALTER TABLE "users" ADD CONSTRAINT "users_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. 대회 전용 문제 표시 + 대회 종료 후 공개 여부 설정
ALTER TABLE "problems" ADD COLUMN "contestOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contests" ADD COLUMN "problemsVisibleAfterEnd" BOOLEAN NOT NULL DEFAULT true;

-- 3. 문제 Q&A 게시판
CREATE TABLE "problem_comments" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "problem_comments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "problem_comments" ADD CONSTRAINT "problem_comments_problemId_fkey"
    FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "problem_comments" ADD CONSTRAINT "problem_comments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "problem_comments" ADD CONSTRAINT "problem_comments_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "problem_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. 수업(ClassRoom) + 등록/전용문제/공지
CREATE TABLE "classrooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "classrooms_slug_key" ON "classrooms"("slug");
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "class_memberships" (
    "classId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "class_memberships_pkey" PRIMARY KEY ("classId","userId")
);
ALTER TABLE "class_memberships" ADD CONSTRAINT "class_memberships_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_memberships" ADD CONSTRAINT "class_memberships_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "class_problems" (
    "classId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "class_problems_pkey" PRIMARY KEY ("classId","problemId")
);
ALTER TABLE "class_problems" ADD CONSTRAINT "class_problems_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_problems" ADD CONSTRAINT "class_problems_problemId_fkey"
    FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "class_notices" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "class_notices_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "class_notices" ADD CONSTRAINT "class_notices_classId_fkey"
    FOREIGN KEY ("classId") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_notices" ADD CONSTRAINT "class_notices_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
