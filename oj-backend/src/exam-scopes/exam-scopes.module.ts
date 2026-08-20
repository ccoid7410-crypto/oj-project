import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExamScopesController } from './exam-scopes.controller';
import { ExamScopesService } from './exam-scopes.service';

@Module({
  imports: [PrismaModule],
  controllers: [ExamScopesController],
  providers: [ExamScopesService],
})
export class ExamScopesModule {}
