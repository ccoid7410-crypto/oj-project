import { Module } from '@nestjs/common';
import { ContestsService } from './contests.service';
import { ContestsController } from './contests.controller';

@Module({
  controllers: [ContestsController],
  providers: [ContestsService],
})
export class ContestsModule {}
