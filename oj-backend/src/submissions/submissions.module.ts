import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { JUDGE_QUEUE } from '../judge/judge.constants';
import { QueuePriorityService } from '../judge/queue-priority.service';
import { StudentIdModule } from '../student-id/student-id.module';

@Module({
  imports: [BullModule.registerQueue({ name: JUDGE_QUEUE }), StudentIdModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, QueuePriorityService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
