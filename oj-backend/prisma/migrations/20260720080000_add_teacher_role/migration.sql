-- 새 enum 값 추가는 그 값을 "사용"하는 문장과 같은 트랜잭션 안에 있으면 실패한다(PG 제약).
-- 이 마이그레이션은 값 추가만 하고 끝나므로 prisma migrate deploy가 감싸는 단일 트랜잭션 안에서도 안전하다.
ALTER TYPE "Role" ADD VALUE 'TEACHER';
