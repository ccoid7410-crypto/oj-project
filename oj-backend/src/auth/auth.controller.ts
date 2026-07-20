import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

class ResendVerificationDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

class VerifyEmailDto {
  @IsString()
  @Length(64, 64)
  token: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 계정 대량 생성/스팸 방지: 같은 IP에서 1분에 5번까지만.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  // 무차별 대입(brute force) 방지: 같은 IP에서 1분에 10번까지만.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  // 재발송 남용 방지: 같은 IP에서 1분에 3번까지만.
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }
}
