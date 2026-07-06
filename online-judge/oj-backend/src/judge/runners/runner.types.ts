export interface LanguageRunnerConfig {
  /** 소스 파일명 (box 디렉토리 내부) */
  fileName: string;
  /** 컴파일에 사용할 도커 이미지 (인터프리터 언어는 runImage와 동일해도 됨) */
  compileImage?: string;
  /** 컴파일 커맨드. null이면 컴파일 단계 생략 (인터프리터 언어) */
  compileCmd: string[] | null;
  /** 실행에 사용할 도커 이미지 */
  runImage: string;
  /** 실행 커맨드 (stdin은 별도로 파이프됨) */
  runCmd: string[];
}
