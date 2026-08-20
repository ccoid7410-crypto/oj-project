CREATE TYPE "ExamScopeType" AS ENUM ('MIDTERM', 'FINAL');

CREATE TABLE "exam_scopes" (
    "id" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "examType" "ExamScopeType" NOT NULL,
    "subject" VARCHAR(80) NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_scopes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_scopes_academicYear_semester_examType_subject_key"
ON "exam_scopes"("academicYear", "semester", "examType", "subject");

CREATE INDEX "exam_scopes_academicYear_semester_examType_displayOrder_idx"
ON "exam_scopes"("academicYear", "semester", "examType", "displayOrder");

ALTER TABLE "exam_scopes" ADD CONSTRAINT "exam_scopes_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "exam_scopes"
  ("id", "academicYear", "semester", "examType", "subject", "displayOrder", "updatedAt")
SELECT
  'exam-2026-2-' || lower(exam_type::text) || '-' || lpad(subject_order::text, 2, '0'),
  2026,
  2,
  exam_type,
  subject_name,
  subject_order,
  CURRENT_TIMESTAMP
FROM unnest(ARRAY['MIDTERM'::"ExamScopeType", 'FINAL'::"ExamScopeType"]) AS exam_type
CROSS JOIN (VALUES
  (1, '전자기와 양자'),
  (2, '화학반응의 세계'),
  (3, '생식과 유전'),
  (4, '지구 시스템 과학'),
  (5, '대수'),
  (6, '미적분1'),
  (7, '정보과학'),
  (8, '공통국어2'),
  (9, '공통영어2'),
  (10, '한국사2')
) AS subjects(subject_order, subject_name);
