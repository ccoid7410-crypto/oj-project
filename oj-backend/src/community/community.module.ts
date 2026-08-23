import { Module } from '@nestjs/common';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [CommunityController, ReportsController],
  providers: [CommunityService, ReportsService],
})
export class CommunityModule {}
