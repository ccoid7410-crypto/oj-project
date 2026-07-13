-- test 태그 문제는 1~1000번(관리자 전용 점검용), 일반 문제는 1001부터 생성순으로 번호를 매긴다.
-- 번호가 유니크 제약이라 도중에 충돌하지 않도록, 먼저 전부 큰 값으로 옮겨둔 뒤 최종 번호를 부여한다.
UPDATE "problems" SET "displayId" = "displayId" + 1000000;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS n
  FROM "problems"
  WHERE 'test' = ANY("tags")
)
UPDATE "problems" p
SET "displayId" = numbered.n
FROM numbered
WHERE p.id = numbered.id;

WITH numbered AS (
  SELECT id, 1000 + ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS n
  FROM "problems"
  WHERE NOT ('test' = ANY("tags"))
)
UPDATE "problems" p
SET "displayId" = numbered.n
FROM numbered
WHERE p.id = numbered.id;

-- 다음 일반 문제가 이어서 번호를 받도록 시퀀스를 맞춘다 (test 문제 번호는 코드에서 별도 부여).
SELECT setval(
  pg_get_serial_sequence('"problems"', 'displayId'),
  (SELECT COALESCE(MAX("displayId"), 1000) FROM "problems" WHERE "displayId" > 1000)
);
