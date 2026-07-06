import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { JUDGE_QUEUE } from '../judge/judge.constants';

@Module({
  imports: [BullModule.registerQueue({ name: JUDGE_QUEUE })],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
