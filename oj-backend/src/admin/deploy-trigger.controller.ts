import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.strategy';
import { DeployTriggerDto } from './dto/deploy-trigger.dto';
import { DeployTriggerService } from './deploy-trigger.service';

@Controller('admin/deploy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DEV', 'ADMIN')
export class DeployTriggerController {
  constructor(private readonly deploy: DeployTriggerService) {}

  @Get('server-info')
  serverInfo() {
    return this.deploy.getServerInfo();
  }

  /** 배포 진행 상황. 눌러놓고 화면을 나갔다 들어와도 여기서 결과를 볼 수 있다. */
  @Get('status')
  status() {
    return this.deploy.status();
  }

  // 되돌리기 번거로운 작업이라 전역 제한(분당 120회)보다 훨씬 빡빡하게 건다(2분에 1회).
  @Throttle({ default: { limit: 1, ttl: 120_000 } })
  @Post()
  trigger(
    @CurrentUser() user: RequestUser,
    @Body() dto: DeployTriggerDto,
  ) {
    return this.deploy.trigger(user.userId, dto.password);
  }
}
