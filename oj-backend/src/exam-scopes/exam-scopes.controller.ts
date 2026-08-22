import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { RequestUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateExamScopeDto,
  EditExamScopeDto,
  ExamScopeQueryDto,
  UpdateExamScopeDto,
} from './dto/exam-scope.dto';
import { ExamScopesService } from './exam-scopes.service';

@Controller('exam-scopes')
export class ExamScopesController {
  constructor(private readonly examScopes: ExamScopesService) {}

  // 시험범위 조회는 로그인 여부와 무관하게 공개한다(홈페이지 시험범위 페이지가
  // 비로그인 방문자에게도 열려 있다). 추가·수정은 아래처럼 부원·관리자만 가능.
  @Get()
  list(@Query() query: ExamScopeQueryDto) {
    return this.examScopes.list(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER', 'ADMIN')
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateExamScopeDto) {
    return this.examScopes.create(user.userId, dto);
  }

  /** 범위 본문만 바꾸는 기존 경로(시험범위 카드의 "범위 수정"). */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER', 'ADMIN')
  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateExamScopeDto,
  ) {
    return this.examScopes.update(id, user.userId, dto.scope);
  }

  /** 과목 이름·범위·표시 순서 편집. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER', 'ADMIN')
  @Patch(':id')
  edit(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: EditExamScopeDto,
  ) {
    return this.examScopes.edit(id, user.userId, dto);
  }
}
