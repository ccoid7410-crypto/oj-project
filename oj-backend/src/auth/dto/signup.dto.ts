import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class SignupDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'username은 3~20자의 영문/숫자/언더스코어만 가능합니다.',
  })
  username: string;

  /** 실명. 필수 입력. */
  @IsString()
  @Length(1, 30, { message: '이름은 1~30자로 입력해주세요.' })
  name: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  @MaxLength(128, { message: '비밀번호는 128자 이하여야 합니다.' })
  password: string;

  /**
   * 입학년도 + 학번(예: 20261119). 선택 입력이지만, 넣는다면 형식이 맞아야 한다.
   * 앞 4자리(입학년도)를 빼먹고 뒤 4자리만 넣는 사람이 많아서 기수 분류가 어긋났던 적이 있다.
   * 동아리 명단이 등록돼 있으면 그 명단에 있는 값이어야 한다.
   */
  @IsOptional()
  @IsString()
  @Matches(/^20\d{6}$/, {
    message: '입학년도 4자리 + 학번 4자리, 총 8자리 숫자로 입력해주세요. (예: 20261119)',
  })
  studentId?: string;
}
