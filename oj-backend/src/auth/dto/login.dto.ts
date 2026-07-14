import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  /**
   * 로그인 식별자. 다음을 모두 허용한다:
   * - 전체 이메일 (cbsh123@cbsh.hs.kr)
   * - 이메일 아이디만 (cbsh123 → @도메인 자동 완성)
   * - 숫자만 (123 → cbsh123@도메인 자동 완성)
   * - 사용자명(username)
   */
  @IsString()
  @MinLength(1)
  identifier: string;

  @IsString()
  password: string;
}
