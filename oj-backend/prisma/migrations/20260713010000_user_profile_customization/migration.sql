-- 계정 커스터마이징: 프로필 이미지(기본 회색) + 자기소개(bio) + 개인 사이트 URL

ALTER TABLE "users" ADD COLUMN "bio" TEXT;
ALTER TABLE "users" ADD COLUMN "website" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar" BYTEA;
ALTER TABLE "users" ADD COLUMN "avatarMime" TEXT;
ALTER TABLE "users" ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);
