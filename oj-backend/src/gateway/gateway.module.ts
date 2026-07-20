import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SubmissionGateway } from './submission.gateway';
import { requireJwtSecret } from '../common/security-config';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requireJwtSecret(config),
        signOptions: { algorithm: 'HS256' },
      }),
    }),
  ],
  providers: [SubmissionGateway],
})
export class GatewayModule {}
