import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsString, Matches, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { StudentIdService } from '../student-id/student-id.service';
import type { RequestUser } from '../auth/jwt.strategy';

class UpdateStudentIdDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9-]{1,20}$/, { message: '학번 형식이 올바르지 않습니다.' })
  studentId: string;
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
  @Post('me/change-password')
  changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  // 정적 경로는 ':username' 파라미터 라우트보다 먼저 선언해야 매칭이 가로채이지 않는다.
  @Get('ranking')
  ranking(@Query('limit') limit?: string) {
    return this.usersService.ranking(limit ? parseInt(limit, 10) : undefined);
  }

  @Get(':username')
  getByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }
}
