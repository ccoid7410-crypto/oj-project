-- 문제 번호(displayId)를 생성 순서대로 1001부터 다시 매긴다.
-- 기존 번호는 1부터 시작해서(시퀀스 기본값) 의도했던 BOJ식 1000번대와 달랐다.
WITH numbered AS (
  SELECT id, 1000 + ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS new_display_id
  FROM "problems"
)
UPDATE "problems" p
SET "displayId" = n.new_display_id
FROM numbered n
WHERE p.id = n.id;

-- 다음에 만들어지는 문제가 이어서(예: 1015) 번호를 받도록 자동증가 시퀀스를 맞춘다.
-- 문제가 하나도 없으면 1000으로 맞춰서 첫 문제가 1001을 받는다.
SELECT setval(
  pg_get_serial_sequence('"problems"', 'displayId'),
  (SELECT COALESCE(MAX("displayId"), 1000) FROM "problems")
);
