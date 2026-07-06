-- 채점 큐 우선순위(동아리 6 : 일반 4) 배분용 단일 행 상태 테이블
CREATE TABLE "queue_pass_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "clubPass" INTEGER NOT NULL DEFAULT 0,
    "generalPass" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_pass_state_pkey" PRIMARY KEY ("id")
);

INSERT INTO "queue_pass_state" ("id", "clubPass", "generalPass", "updatedAt")
VALUES (1, 0, 0, CURRENT_TIMESTAMP);
