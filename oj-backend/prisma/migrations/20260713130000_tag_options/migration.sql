-- 태그 목록을 관리자가 관리할 수 있는 테이블로 옮긴다 (코드 하드코딩 제거).
CREATE TABLE "tag_options" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tag_options_name_key" ON "tag_options"("name");

-- 시작 태그: test (관리자 전용 점검 문제 표시용)
INSERT INTO "tag_options" ("id", "name") VALUES (gen_random_uuid()::text, 'test');

-- 기존 문제의 태그를 정리한다. 기능과 묶인 태그(test=관리자 전용 숨김, 대회전용=대회 문제 표시)만 남긴다.
UPDATE "problems"
SET "tags" = ARRAY(SELECT t FROM unnest("tags") AS t WHERE t IN ('test', '대회전용'));
