import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { RequestUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ExamScopeQueryDto, UpdateExamScopeDto } from './dto/exam-scope.dto';
import { ExamScopesService } from './exam-scopes.service';

@Controller('exam-scopes')
export class ExamScopesController {
  constructor(private readonly examScopes: ExamScopesService) {}

  // 시험범위 조회는 로그인 여부와 무관하게 공개한다(홈페이지 시험범위 페이지가
  // 비로그인 방문자에게도 열려 있다). 수정은 아래처럼 부원·관리자만 가능.
  @Get()
  list(@Query() query: ExamScopeQueryDto) {
    return this.examScopes.list(query);
  }

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
}
