import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JudgeProcessor } from './judge.processor';
import { JudgeRunnerService } from './judge-runner.service';
import { DockerSandboxService } from './sandbox/docker-sandbox.service';
import { SandboxCleanupService } from './sandbox-cleanup.service';
import { JUDGE_QUEUE } from './judge.constants';

/**
 * 채점 실행 모듈.
 *
 * JudgeRunnerService/DockerSandboxService/SandboxCleanupService는 DB를 안 쓰므로
 * 채점 VM에 그대로 남고, DB가 필요한 payload/ingest는 InternalModule(Global)에서 주입된다.
 * 4단계에서 BullModule과 JudgeProcessor가 빠지면 이 모듈이 곧 채점 VM의 전부가 된다.
 */
@Module({
  imports: [BullModule.registerQueue({ name: JUDGE_QUEUE })],
  providers: [JudgeProcessor, JudgeRunnerService, DockerSandboxService, SandboxCleanupService],
  exports: [JudgeRunnerService],
})
export class JudgeModule {}
