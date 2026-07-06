import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * 메일 발송 서비스. SMTP_HOST 등이 설정돼 있으면 실제로 발송하고,
 * 아니면(로컬 개발 환경) 링크를 로그로만 남긴다 - 별도 메일 서버 없이도 인증 플로우를 테스트할 수 있게.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('MAIL_FROM', 'no-reply@durunuri-oj.local');
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT', 587),
        secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
        auth: this.config.get<string>('SMTP_USER')
          ? { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASS') }
          : undefined,
      });
    } else {
      this.transporter = null;
    }
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    const subject = '[Durunuri OJ] 이메일 인증';
    const text = `아래 링크를 눌러 이메일 인증을 완료하세요 (24시간 내 유효):\n\n${verifyUrl}`;

    if (!this.transporter) {
      // SMTP 미설정 상태(로컬 개발): 실제 발송 대신 로그로 링크를 남긴다.
      this.logger.warn(`[DEV] SMTP 미설정 - ${to}로 보낼 인증 링크를 대신 로그로 남깁니다: ${verifyUrl}`);
      return;
    }

    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }
}
