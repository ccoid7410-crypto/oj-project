-- 프로필 확장: 배너 이미지 + 사이트 여러 개(websites 배열) + 계정 귀속 테마 설정

ALTER TABLE "users" ADD COLUMN "banner" BYTEA;
ALTER TABLE "users" ADD COLUMN "bannerMime" TEXT;
ALTER TABLE "users" ADD COLUMN "bannerUpdatedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "websites" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "users" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'system';

-- 기존 단일 website 값을 websites 배열로 이관 후 컬럼 제거
UPDATE "users" SET "websites" = ARRAY["website"] WHERE "website" IS NOT NULL AND "website" <> '';
ALTER TABLE "users" DROP COLUMN "website";
