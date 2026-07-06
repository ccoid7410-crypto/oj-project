import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JudgeProcessor } from './judge.processor';
import { DockerSandboxService } from './sandbox/docker-sandbox.service';
import { JudgeConfigModule } from '../judge-config/judge-config.module';
import { RatingModule } from '../rating/rating.module';
import { JUDGE_QUEUE } from './judge.constants';

@Module({
  imports: [BullModule.registerQueue({ name: JUDGE_QUEUE }), JudgeConfigModule, RatingModule],
  providers: [JudgeProcessor, DockerSandboxService],
})
export class JudgeModule {}
