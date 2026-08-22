import { Global, Module } from '@nestjs/common';
import { UserNotificationsService } from './user-notifications.service';
import { UserNotificationsController } from './user-notifications.controller';

// 신고·멘션 등 여러 모듈에서 알림을 보내므로 전역으로 제공한다.
@Global()
@Module({
  controllers: [UserNotificationsController],
  providers: [UserNotificationsService],
  exports: [UserNotificationsService],
})
export class UserNotificationsModule {}
