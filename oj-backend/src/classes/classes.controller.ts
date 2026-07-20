import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.strategy';
import { ClassesService } from './classes.service';

class CreateClassDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;
}

class MemberDto {
  @IsString()
  @MaxLength(64)
  userId: string;
}

class SetClassProblemsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  problemIds: string[];
}

class NoticeDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(20_000)
  content: string;
}

@UseGuards(JwtAuthGuard)
@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  listMine(@CurrentUser() user: RequestUser) {
    return this.classes.listMine(user.userId);
  }

  @Get(':slug')
  getDetail(@Param('slug') slug: string, @CurrentUser() user: RequestUser) {
    return this.classes.getDetail(slug, user.userId, user.role);
  }
}

// 수업 관리는 선생님도 전부 쓸 수 있다("수업(반) 관리") - ADMIN과 동일한 권한.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'TEACHER')
@Controller('admin/classes')
export class AdminClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  listAll() {
    return this.classes.listAll();
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateClassDto) {
    return this.classes.create(user.userId, dto.name, dto.slug, dto.description);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.classes.remove(id);
  }

  @Get(':id/members')
  listMembers(@Param('id') id: string) {
    return this.classes.listMembers(id);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: MemberDto) {
    return this.classes.addMember(id, dto.userId);
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.classes.removeMember(id, userId);
  }

  @Put(':id/problems')
  setProblems(@Param('id') id: string, @Body() dto: SetClassProblemsDto) {
    return this.classes.setProblems(id, dto.problemIds);
  }

  @Post(':id/notices')
  addNotice(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: NoticeDto) {
    return this.classes.addNotice(id, user.userId, dto.title, dto.content);
  }

  @Delete('notices/:noticeId')
  removeNotice(@Param('noticeId') noticeId: string) {
    return this.classes.removeNotice(noticeId);
  }
}
