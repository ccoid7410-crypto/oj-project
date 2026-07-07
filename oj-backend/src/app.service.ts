import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Durunuri OJ API';
  }

  async health() {
    const startedAt = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      uptimeSec: Math.floor(process.uptime()),
      database: 'ok',
      latencyMs: Date.now() - startedAt,
    };
  }
}
