-- 커뮤니티 확장: 보드(OJ/HOME) 구분 + 게시글 유형(공지/업데이트로그) + 태그

-- CreateEnum
CREATE TYPE "CommunityBoard" AS ENUM ('OJ', 'HOME');

-- CreateEnum
CREATE TYPE "CommunityPostType" AS ENUM ('NORMAL', 'UPDATE_LOG', 'NOTICE');

-- AlterTable
ALTER TABLE "community_posts" ADD COLUMN "board" "CommunityBoard" NOT NULL DEFAULT 'OJ';
ALTER TABLE "community_posts" ADD COLUMN "type" "CommunityPostType" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "community_posts" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';

-- 목록 정렬 인덱스를 보드별로 교체
DROP INDEX IF EXISTS "community_posts_createdAt_idx";
CREATE INDEX "community_posts_board_createdAt_idx" ON "community_posts"("board", "createdAt");

-- CreateTable
CREATE TABLE "community_tags" (
    "id" TEXT NOT NULL,
    "board" "CommunityBoard" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_tags_board_name_key" ON "community_tags"("board", "name");
