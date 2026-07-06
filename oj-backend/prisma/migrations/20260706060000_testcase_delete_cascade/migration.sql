-- 테스트케이스 삭제 시 그 테스트케이스에 대한 과거 채점 결과 행(submission_test_results)도
-- 같이 지워지도록 변경한다. 기존엔 ON DELETE 지정이 없어(기본 RESTRICT) 이미 한 번이라도
-- 채점에 쓰인 테스트케이스는 삭제가 항상 외래키 위반으로 실패했다.
ALTER TABLE "submission_test_results" DROP CONSTRAINT "submission_test_results_testCaseId_fkey";
ALTER TABLE "submission_test_results" ADD CONSTRAINT "submission_test_results_testCaseId_fkey"
    FOREIGN KEY ("testCaseId") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
