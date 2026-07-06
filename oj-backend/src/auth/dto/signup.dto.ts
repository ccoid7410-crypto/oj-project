import { IsEmail, IsOptional, IsString, MinLength, Matches } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'username은 3~20자의 영문/숫자/언더스코어만 가능합니다.',
  })
  username: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  password: string;

  /** 학번. 선택 입력이며, 동아리 명단이 등록돼 있으면 그 명단에 있는 학번이어야 한다. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9-]{1,20}$/, { message: '학번 형식이 올바르지 않습니다.' })
  studentId?: string;
}
