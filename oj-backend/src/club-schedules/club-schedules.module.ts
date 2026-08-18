import { Module } from '@nestjs/common';
import { ClubSchedulesController } from './club-schedules.controller';
import { ClubSchedulesService } from './club-schedules.service';

@Module({
  controllers: [ClubSchedulesController],
  providers: [ClubSchedulesService],
})
export class ClubSchedulesModule {}
