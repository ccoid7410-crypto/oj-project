import { Global, Module } from '@nestjs/common';
import { JudgeConfigModule } from '../judge-config/judge-config.module';
import { RatingModule } from '../rating/rating.module';
import { InternalJudgeController } from './internal-judge.controller';
import { InternalTokenGuard } from './internal-token.guard';
import { JudgeIngestService } from './judge-ingest.service';
import { JudgePayloadService } from './judge-payload.service';
import { SubmissionCompletionRegistry } from './submission-completion.registry';

/**
 * 인터체인저 ↔ API 사이의 내부 경계.
 *
 * Global인 이유: SubmissionCompletionRegistry가 문제 검증(problems.service)에서도 쓰이는데,
 * 결과를 넣는 쪽(JudgeIngestService)과 기다리는 쪽이 **반드시 같은 인스턴스**여야 하기 때문이다.
 * 모듈마다 별도 인스턴스가 생기면 깨우는 신호가 영영 도착하지 않는다.
 */
@Global()
@Module({
  imports: [JudgeConfigModule, RatingModule],
  controllers: [InternalJudgeController],
  providers: [
    JudgePayloadService,
    JudgeIngestService,
    SubmissionCompletionRegistry,
    InternalTokenGuard,
  ],
  exports: [JudgePayloadService, JudgeIngestService, SubmissionCompletionRegistry],
})
export class InternalModule {}
