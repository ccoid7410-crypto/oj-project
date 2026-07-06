import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { UsersModule } from '../users/users.module';
import { JudgeConfigModule } from '../judge-config/judge-config.module';
import { RatingModule } from '../rating/rating.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentIdModule } from '../student-id/student-id.module';
import { ProblemsModule } from '../problems/problems.module';
import { AdminStatsService } from './admin-stats.service';

@Module({
  imports: [UsersModule, JudgeConfigModule, RatingModule, NotificationsModule, StudentIdModule, ProblemsModule],
  controllers: [AdminController],
  providers: [AdminStatsService],
})
export class AdminModule {}
