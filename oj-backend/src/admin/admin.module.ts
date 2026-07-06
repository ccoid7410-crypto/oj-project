import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { UsersModule } from '../users/users.module';
import { JudgeConfigModule } from '../judge-config/judge-config.module';
import { RatingModule } from '../rating/rating.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentIdModule } from '../student-id/student-id.module';

@Module({
  imports: [UsersModule, JudgeConfigModule, RatingModule, NotificationsModule, StudentIdModule],
  controllers: [AdminController],
})
export class AdminModule {}
