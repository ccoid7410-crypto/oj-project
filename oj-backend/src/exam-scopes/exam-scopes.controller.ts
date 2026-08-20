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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MEMBER', 'ADMIN')
export class ExamScopesController {
  constructor(private readonly examScopes: ExamScopesService) {}

  @Get()
  list(@Query() query: ExamScopeQueryDto) {
    return this.examScopes.list(query);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateExamScopeDto,
  ) {
    return this.examScopes.update(id, user.userId, dto.scope);
  }
}
