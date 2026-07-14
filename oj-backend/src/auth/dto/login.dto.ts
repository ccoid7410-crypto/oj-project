import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  /**
   * 로그인 식별자. 다음을 모두 허용한다:
   * - 전체 이메일 (cbsh12345@cbsh.hs.kr)
   * - 이메일 아이디만 (cbsh12345 → @도메인 자동 완성)
   * - 사용자명(username, 유일하므로 그대로 조회 가능)
   */
  @IsString()
  @MinLength(1)
  identifier: string;

  @IsString()
  password: string;
}
