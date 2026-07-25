import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { InternalModule } from './internal.module';
import { InternalJudgeController } from './internal-judge.controller';
import { InternalTokenGuard } from './internal-token.guard';

/**
 * 내부 리스너(INTERNAL_PORT) 전용 앱의 루트 모듈. 인터체인저만 여기에 접근한다.
 *
 * 공개 앱(:3000)과 **별도의 Nest 앱**으로 띄우는 이유:
 * nginx가 `/api/(.*)` → `/$1` 로 접두사를 벗겨내기 때문에, 같은 리스너에 내부 라우트가
 * 있으면 브라우저가 `/api/internal/judge/ingest` 로 요청해서 그대로 닿을 수 있다.
 * 토큰 가드가 막긴 하지만, 애초에 그 포트에 라우트가 존재하지 않게 만드는 편이 확실하다.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    InternalModule,
  ],
  controllers: [InternalJudgeController],
  providers: [InternalTokenGuard],
})
export class InternalApiModule {}
