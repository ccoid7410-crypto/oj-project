import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.strategy';
import { UserNotificationsService } from './user-notifications.service';
import { PrismaService } from '../prisma/prisma.service';

class SendNotificationDto {
  /** 받을 사람들의 사용자명. 비우면 아무에게도 안 간다. */
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  usernames: string[];

  @IsString()
  @MinLength(1, { message: '제목을 입력해주세요.' })
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class UserNotificationsController {
  constructor(
    private readonly notifications: UserNotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.notifications.list(user.userId);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notifications.unreadCount(user.userId);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notifications.markAllRead(user.userId);
  }

  /** 관리자가 사용자들에게 직접 알림을 보낸다. */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('send')
  async send(
    @CurrentUser() admin: RequestUser,
    @Body() dto: SendNotificationDto,
  ) {
    const targets = await this.prisma.user.findMany({
      where: { username: { in: dto.usernames } },
      select: { id: true, username: true },
    });
    const sender = await this.prisma.user.findUnique({
      where: { id: admin.userId },
      select: { username: true },
    });

    await Promise.all(
      targets.map((t) =>
        this.notifications.send({
          userId: t.id,
          type: 'ADMIN_MESSAGE',
          title: dto.title,
          body: dto.body ?? '',
          sender: sender?.username ?? 'Durunuri OJ',
          linkUrl: dto.linkUrl ?? '',
        }),
      ),
    );

    const found = new Set(targets.map((t) => t.username));
    return {
      sent: targets.length,
      notFound: dto.usernames.filter((u) => !found.has(u)),
    };
  }

  // 상세는 :id 라우트라 위의 고정 경로들보다 뒤에 와야 한다.
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.get(id, user.userId);
  }
}
