import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
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

class DeleteAccountDto {
  @IsString()
  password: string;
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

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: '소개는 300자 이하여야 합니다.' })
  bio?: string;

  // 프로필에 그대로 링크로 노출되므로 http/https 외 스킴(javascript: 등)은 차단한다.
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '사이트 주소는 200자 이하여야 합니다.' })
  @Matches(/^$|^https?:\/\/\S+$/, { message: '사이트 주소는 http:// 또는 https:// 로 시작해야 합니다.' })
  website?: string;
}

class UpdateAvatarDto {
  @IsIn(['image/png', 'image/jpeg', 'image/webp'], {
    message: 'PNG/JPEG/WebP 이미지만 업로드할 수 있습니다.',
  })
  mime: string;

  // base64 인코딩된 이미지 바이트. 1MB 원본 기준 base64는 약 1.4MB.
  @IsString()
  @MaxLength(1_500_000, { message: '이미지는 1MB 이하여야 합니다.' })
  data: string;
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

  /** 본인 탈퇴. 비밀번호를 다시 확인받고 계정과 활동 기록을 삭제한다. */
  @UseGuards(JwtAuthGuard)
  @Post('me/delete-account')
  deleteAccount(@CurrentUser() user: RequestUser, @Body() dto: DeleteAccountDto) {
    return this.usersService.deleteOwnAccount(user.userId, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/profile')
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/avatar')
  updateAvatar(@CurrentUser() user: RequestUser, @Body() dto: UpdateAvatarDto) {
    return this.usersService.updateAvatar(user.userId, dto.mime, dto.data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/avatar')
  deleteAvatar(@CurrentUser() user: RequestUser) {
    return this.usersService.deleteAvatar(user.userId);
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

  /** 공개 프로필 이미지. 없으면 404 → 프론트가 기본(회색) 아바타를 그린다. */
  @Get(':username/avatar')
  async getAvatar(@Param('username') username: string, @Res() res: Response) {
    const avatar = await this.usersService.getAvatar(username);
    if (!avatar) throw new NotFoundException('프로필 이미지가 없습니다.');
    res.setHeader('Content-Type', avatar.mime);
    // URL에 ?v=버전이 붙으므로 오래 캐시해도 안전하다(이미지가 바뀌면 URL도 바뀜).
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // 업로드 바이트를 그대로 돌려주는 응답이라, 브라우저가 내용을 문서로 추측(sniffing)해
    // 실행하는 일이 없도록 명시한다.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(avatar.bytes);
  }

  @Get(':username')
  getByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }
}
