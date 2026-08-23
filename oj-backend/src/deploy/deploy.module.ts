import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DeployController } from './deploy.controller';
import { DeployService } from './deploy.service';
import { DeployTokenGuard } from './deploy-token.guard';

/**
 * 배포 에이전트의 루트 모듈. **API 서버(:3000)와 완전히 분리된 별도 프로세스/컨테이너**로
 * 띄운다 - docker.sock을 쥐는 유일한 서비스라 사실상 호스트 root와 동급 권한이고,
 * 그 권한을 메인 API(로그인한 유저의 요청을 직접 받는 서비스)에는 절대 주지 않는다.
 * 이 컨테이너는 compose 내부망(backend_net)에만 존재하고 호스트로 포트를 publish하지
 * 않으므로 브라우저/인터넷에서는 절대 닿을 수 없다 - API 서버만 내부망을 통해 호출한다.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [DeployController],
  providers: [DeployService, DeployTokenGuard],
})
export class DeployModule {}
