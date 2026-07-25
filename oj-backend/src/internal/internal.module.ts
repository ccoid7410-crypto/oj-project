import { Global, Module } from '@nestjs/common';
import { JudgeConfigModule } from '../judge-config/judge-config.module';
import { RatingModule } from '../rating/rating.module';
import { JudgeIngestService } from './judge-ingest.service';
import { JudgePayloadService } from './judge-payload.service';
import { SubmissionCompletionRegistry } from './submission-completion.registry';

/**
 * 채점 파이프라인의 DB 접점(재료 조립 / 결과 수집).
 *
 * **컨트롤러는 여기 없다.** HTTP로 노출하는 부분은 InternalApiModule이 맡고, 그건 공개
 * 리스너가 아닌 내부 리스너(INTERNAL_PORT)에만 마운트된다. 서비스와 라우팅을 분리해야
 * 공개 앱(:3000)에 내부 엔드포인트가 딸려 올라가는 사고를 구조적으로 막을 수 있다.
 *
 * Global인 이유: SubmissionCompletionRegistry는 문제 검증(problems.service)에서도 쓰는데,
 * 앱 안에서 반드시 같은 인스턴스여야 신호가 도착한다.
 */
@Global()
@Module({
  imports: [JudgeConfigModule, RatingModule],
  providers: [
    JudgePayloadService,
    JudgeIngestService,
    SubmissionCompletionRegistry,
  ],
  exports: [
    JudgePayloadService,
    JudgeIngestService,
    SubmissionCompletionRegistry,
  ],
})
export class InternalModule {}
