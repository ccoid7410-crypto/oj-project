import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeployTriggerDto {
  // 배포는 되돌리기 번거로운 작업이라, 세션 탈취만으로는 못 누르게 비밀번호 재확인을 요구한다
  // (계정 탈퇴(users.controller.ts)와 동일한 step-up 인증 패턴).
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password: string;
}
