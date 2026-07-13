import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsString, Length, Matches, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { StudentIdService } from '../student-id/student-id.service';
import type { RequestUser } from '../auth/jwt.strategy';

class UpdateStudentIdDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9-]{1,20}$/, { message: '학번 형식이 올바르지 않습니다.' })
  studentId: string;
}

class UpdateNameDto {
  @IsString()
  @Length(1, 30, { message: '이름은 1~30자로 입력해주세요.' })
  name: string;
}

const LANGUAGES = ['C', 'CPP', 'JAVA', 'PYTHON3', 'JAVASCRIPT', 'GO'] as const;
type LanguageValue = (typeof LANGUAGES)[number];

class UpdatePreferredLanguageDto {
  @IsIn(LANGUAGES, { message: '지원하지 않는 언어입니다.' })
  language: LanguageValue;
}

class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  newPassword: string;
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly studentId: StudentIdService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: RequestUser) {
    return this.usersService.findById(user.userId);
  }

  /** 동아리 홈페이지의 마이페이지/접속 제한이 사용하는 본인 정보. */
  @UseGuards(JwtAuthGuard)
  @Get('me/club-profile')
  clubProfile(@CurrentUser() user: RequestUser) {
    return this.usersService.clubProfile(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/student-id-window')
  async getStudentIdWindow() {
    const window = await this.studentId.getWindow();
    return { ...window, isOpen: await this.studentId.isWindowOpen() };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/student-id')
  updateStudentId(@CurrentUser() user: RequestUser, @Body() dto: UpdateStudentIdDto) {
    return this.studentId.updateOwnStudentId(user.userId, dto.studentId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/name')
  updateName(@CurrentUser() user: RequestUser, @Body() dto: UpdateNameDto) {
    return this.usersService.updateName(user.userId, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/preferred-language')
  updatePreferredLanguage(@CurrentUser() user: RequestUser, @Body() dto: UpdatePreferredLanguageDto) {
    return this.usersService.updatePreferredLanguage(user.userId, dto.language);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/change-password')
  changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  // 정적 경로는 ':username' 파라미터 라우트보다 먼저 선언해야 매칭이 가로채이지 않는다.
  @Get('ranking')
  ranking(@Query('limit') limit?: string) {
    return this.usersService.ranking(limit ? parseInt(limit, 10) : undefined);
  }

  /** 동아리 홈페이지의 명예의 전당. 부원(MEMBER) 이상만 조회할 수 있다. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER', 'ADMIN')
  @Get('hall-of-fame')
  hallOfFame() {
    return this.usersService.hallOfFame();
  }

  @Get(':username')
  getByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }
}
