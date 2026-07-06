-- queue_pass_state는 딱 1행을 제출마다 UPDATE(increment)하는 "핫 로우"라서,
-- Postgres MVCC 특성상 매 제출마다 죽은 튜플(dead tuple)이 하나씩 쌓인다.
-- 기본 autovacuum 임계값(threshold=50 + scale_factor 20%)은 이런 초소형 테이블 기준으로도
-- 최소 50개의 죽은 튜플이 쌓여야 청소가 도는데, 서버를 오래 켜두고 제출이 계속 들어오면
-- 그 사이에 테이블/인덱스가 계속 부풀어서 (사이즈 자체는 작아도) vacuum/checkpoint 부담이 커지고
-- 전반적인 반응성이 서서히 나빠지는 원인이 된다. 이 테이블만 훨씬 더 자주 청소되도록 낮춘다.
ALTER TABLE "queue_pass_state" SET (
    autovacuum_vacuum_scale_factor = 0,
    autovacuum_vacuum_threshold = 20,
    autovacuum_analyze_scale_factor = 0,
    autovacuum_analyze_threshold = 20
);
