import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DeployTokenGuard } from './deploy-token.guard';
import { DeployService, type DeployStatus } from './deploy.service';

@Controller()
export class DeployController {
  constructor(private readonly deploy: DeployService) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  // 요청 바디를 아예 받지 않는다 - 이 엔드포인트가 받는 유일한 입력은
  // "지금 배포해라"라는 사실 자체이고, 어떤 파라미터도 실행될 커맨드에 영향을 주지 않는다.
  //
  // 실행은 백그라운드로 돌리고 바로 응답한다(마지막 단계에서 이 컨테이너 자신이
  // 재생성되므로 응답을 붙잡고 있으면 성공해도 연결이 끊긴다). 진행 상황은 status로 본다.
  @UseGuards(DeployTokenGuard)
  @Post('deploy')
  async trigger(): Promise<{ started: boolean }> {
    return { started: await this.deploy.start() };
  }

  @UseGuards(DeployTokenGuard)
  @Get('deploy/status')
  async status(): Promise<DeployStatus> {
    return this.deploy.status();
  }
}
