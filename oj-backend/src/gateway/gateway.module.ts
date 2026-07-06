import { Module } from '@nestjs/common';
import { SubmissionGateway } from './submission.gateway';

@Module({
  providers: [SubmissionGateway],
})
export class GatewayModule {}
