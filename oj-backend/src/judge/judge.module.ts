import { Module } from '@nestjs/common';
import { InterchangerClientService } from './interchanger-client.service';
import { JudgeRunnerService } from './judge-runner.service';
import { DockerSandboxService } from './sandbox/docker-sandbox.service';
import { SandboxCleanupService } from './sandbox-cleanup.service';

/**
 * 채점 VM에 올라가는 전부.
 *
 * 여기 어디에도 PrismaModule / BullModule이 없다는 점이 핵심이다. 채점기는 DB도 Redis도
 * 모르고, 인터체인저로 아웃바운드 연결만 해서 일감을 받아 결과를 돌려준다.
 * 샌드박스를 탈출당해도 넘어갈 자격증명이 애초에 존재하지 않는다.
 */
@Module({
  providers: [
    InterchangerClientService,
    JudgeRunnerService,
    DockerSandboxService,
    SandboxCleanupService,
  ],
  exports: [JudgeRunnerService],
})
export class JudgeModule {}
