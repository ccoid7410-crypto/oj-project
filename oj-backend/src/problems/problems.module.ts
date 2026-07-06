import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProblemsService } from './problems.service';
import { ProblemsController } from './problems.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { JUDGE_QUEUE } from '../judge/judge.constants';

@Module({
  imports: [NotificationsModule, BullModule.registerQueue({ name: JUDGE_QUEUE })],
  controllers: [ProblemsController],
  providers: [ProblemsService],
  exports: [ProblemsService],
})
export class ProblemsModule {}
