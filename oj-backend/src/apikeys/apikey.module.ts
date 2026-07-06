import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiKeyService } from './apikey.service';
import { ApiKeyGuard } from './apikey.guard';
import { ApiKeyController } from './apikey.controller';
import { ExternalController } from './external.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ApiKeyController, ExternalController],
  providers: [ApiKeyService, ApiKeyGuard],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
