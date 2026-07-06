-- 학번은 계정당 유일해야 한다 (한 학번으로 여러 계정 등록 방지).
CREATE UNIQUE INDEX "users_studentId_key" ON "users"("studentId");
