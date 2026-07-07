import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export type MailStatus = {
  configured: boolean;
  provider: string;
  host: string | null;
  port: number | null;
  secure: boolean;
  from: string;
  user: string | null;
  ready: boolean;
  message: string;
};

/**
 * 메일 발송 서비스. SMTP_HOST 등이 설정돼 있으면 실제로 발송하고,
 * 아니면(로컬 개발 환경) 링크를 로그로만 남긴다 - 별도 메일 서버 없이도 인증 플로우를 테스트할 수 있게.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;
  private readonly provider: string;
  private readonly host: string | null;
  private readonly port: number | null;
  private readonly secure: boolean;
  private readonly user: string | null;

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get<string>('MAIL_PROVIDER', '').toLowerCase();
    const smtpUser = this.config.get<string>('SMTP_USER') || null;
    this.host = this.resolveHost();
    this.port = this.resolvePort();
    this.secure = this.config.get<string>('SMTP_SECURE', this.port === 465 ? 'true' : 'false') === 'true';
    this.user = smtpUser;
    this.from = this.config.get<string>('MAIL_FROM', smtpUser ?? 'no-reply@durunuri-oj.local');

    if (this.host) {
      this.transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port ?? 587,
        secure: this.secure,
        auth: smtpUser ? { user: smtpUser, pass: this.config.get<string>('SMTP_PASS') } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
    } else {
      this.transporter = null;
    }
  }

  getStatus(): MailStatus {
    if (!this.transporter) {
      return {
        configured: false,
        provider: this.provider || 'log-only',
        host: null,
        port: null,
        secure: false,
        from: this.from,
        user: null,
        ready: true,
        message: 'SMTP 미설정 상태입니다. 인증 링크는 서버 로그에만 남습니다.',
      };
    }

    const hasAuth = !this.user || !!this.config.get<string>('SMTP_PASS');
    return {
      configured: true,
      provider: this.provider || 'smtp',
      host: this.host,
      port: this.port,
      secure: this.secure,
      from: this.from,
      user: this.user ? this.maskEmail(this.user) : null,
      ready: hasAuth,
      message: hasAuth
        ? '메일 발송 설정이 입력돼 있습니다.'
        : 'SMTP_USER가 있지만 SMTP_PASS가 비어 있습니다. Gmail은 계정 비밀번호가 아니라 앱 비밀번호가 필요합니다.',
    };
  }

  async verifyConnection(): Promise<MailStatus> {
    const status = this.getStatus();
    if (!this.transporter) return status;

    try {
      await this.transporter.verify();
      return { ...status, ready: true, message: 'SMTP 연결 확인에 성공했습니다.' };
    } catch (err) {
      this.logger.error(`SMTP 연결 확인 실패: ${this.describeError(err)}`);
      return { ...status, ready: false, message: `SMTP 연결 확인 실패: ${this.describeError(err)}` };
    }
  }

  async sendTestEmail(to: string): Promise<{ ok: boolean; message: string }> {
    const subject = '[Durunuri OJ] 메일 발송 테스트';
    const text = 'Durunuri OJ 메일 설정이 정상적으로 동작합니다.';

    if (!this.transporter) {
      this.logger.warn(`[DEV] SMTP 미설정 - ${to}로 보낼 테스트 메일을 실제 발송하지 않았습니다.`);
      return { ok: true, message: 'SMTP 미설정 상태라 실제 발송 대신 서버 로그에만 기록했습니다.' };
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
      return { ok: true, message: `${to}로 테스트 메일을 보냈습니다.` };
    } catch (err) {
      this.logger.error(`테스트 메일 발송 실패(${to}): ${this.describeError(err)}`);
      return { ok: false, message: `테스트 메일 발송 실패: ${this.describeError(err)}` };
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

  private resolveHost(): string | null {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) return host;
    if (this.provider === 'gmail') return 'smtp.gmail.com';
    return null;
  }

  private resolvePort(): number | null {
    const raw = this.config.get<string>('SMTP_PORT');
    if (raw) {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 587;
    }
    if (this.provider === 'gmail') return 587;
    return this.host ? 587 : null;
  }

  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (!domain) return '***';
    return `${name.slice(0, 2)}***@${domain}`;
  }

  private describeError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
