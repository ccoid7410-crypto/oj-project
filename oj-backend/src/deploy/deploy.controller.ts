import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DeployTokenGuard } from './deploy-token.guard';
import { DeployService, type DeployResult } from './deploy.service';

@Controller()
export class DeployController {
  constructor(private readonly deploy: DeployService) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  // 요청 바디를 아예 받지 않는다 - 이 엔드포인트가 받는 유일한 입력은
  // "지금 배포해라"라는 사실 자체이고, 어떤 파라미터도 실행될 커맨드에 영향을 주지 않는다.
  @UseGuards(DeployTokenGuard)
  @Post('deploy')
  async trigger(): Promise<DeployResult> {
    return this.deploy.deploy();
  }
}
