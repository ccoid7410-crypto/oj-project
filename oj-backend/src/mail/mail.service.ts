import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

export type MailStatus = {
  configured: boolean;
  source: 'database' | 'environment' | 'log-only';
  provider: string;
  host: string | null;
  port: number | null;
  secure: boolean;
  from: string;
  user: string | null;
  ready: boolean;
  message: string;
};

type EffectiveMailConfig = {
  source: 'database' | 'environment' | 'log-only';
  enabled: boolean;
  provider: string;
  from: string;
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  pass: string | null;
};

export type SaveGmailConfigInput = {
  from: string;
  smtpUser: string;
  smtpPass?: string;
};

/**
 * 메일 발송 서비스. SMTP_HOST 등이 설정돼 있으면 실제로 발송하고,
 * 아니면(로컬 개발 환경) 링크를 로그로만 남긴다 - 별도 메일 서버 없이도 인증 플로우를 테스트할 수 있게.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getStatus(): Promise<MailStatus> {
    const effective = await this.getEffectiveConfig();
    if (!effective.enabled || !effective.host) {
      return {
        configured: false,
        source: effective.source,
        provider: effective.provider || 'log-only',
        host: null,
        port: null,
        secure: false,
        from: effective.from,
        user: null,
        ready: true,
        message: 'SMTP 미설정 상태입니다. 인증 링크는 서버 로그에만 남습니다.',
      };
    }

    const hasAuth = !effective.user || !!effective.pass;
    return {
      configured: true,
      source: effective.source,
      provider: effective.provider || 'smtp',
      host: effective.host,
      port: effective.port,
      secure: effective.secure,
      from: effective.from,
      user: effective.user ? this.maskEmail(effective.user) : null,
      ready: hasAuth,
      message: hasAuth
        ? '메일 발송 설정이 입력돼 있습니다.'
        : 'SMTP_USER가 있지만 SMTP_PASS가 비어 있습니다. Gmail은 계정 비밀번호가 아니라 앱 비밀번호가 필요합니다.',
    };
  }

  async verifyConnection(): Promise<MailStatus> {
    const effective = await this.getEffectiveConfig();
    const status = await this.getStatus();
    const transporter = this.createTransporter(effective);
    if (!transporter) return status;

    try {
      await transporter.verify();
      return { ...status, ready: true, message: 'SMTP 연결 확인에 성공했습니다.' };
    } catch (err) {
      this.logger.error(`SMTP 연결 확인 실패: ${this.describeError(err)}`);
      return { ...status, ready: false, message: `SMTP 연결 확인 실패: ${this.describeError(err)}` };
    }
  }

  async saveGmailConfig(input: SaveGmailConfigInput, updatedById: string): Promise<MailStatus> {
    const current = await this.prisma.mailConfig.findUnique({ where: { id: 1 } });
    const smtpPass = input.smtpPass?.trim() || current?.smtpPass;
    if (!smtpPass) {
      return {
        configured: false,
        source: 'database',
        provider: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        from: input.from,
        user: this.maskEmail(input.smtpUser),
        ready: false,
        message: 'Gmail 앱 비밀번호를 입력해야 저장할 수 있습니다.',
      };
    }

    await this.prisma.mailConfig.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        enabled: true,
        provider: 'gmail',
        from: input.from.trim(),
        smtpUser: input.smtpUser.trim(),
        smtpPass,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
        updatedById,
      },
      update: {
        enabled: true,
        provider: 'gmail',
        from: input.from.trim(),
        smtpUser: input.smtpUser.trim(),
        smtpPass,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: false,
        updatedById,
      },
    });

    return this.verifyConnection();
  }

  async disableDatabaseConfig(updatedById: string): Promise<MailStatus> {
    const current = await this.prisma.mailConfig.findUnique({ where: { id: 1 } });
    if (current) {
      await this.prisma.mailConfig.update({
        where: { id: 1 },
        data: { enabled: false, updatedById },
      });
    }
    return this.verifyConnection();
  }

  async sendTestEmail(to: string): Promise<{ ok: boolean; message: string }> {
    const effective = await this.getEffectiveConfig();
    const transporter = this.createTransporter(effective);
    const subject = '[Durunuri OJ] 메일 발송 테스트';
    const text = 'Durunuri OJ 메일 설정이 정상적으로 동작합니다.';

    if (!transporter) {
      this.logger.warn(`[DEV] SMTP 미설정 - ${to}로 보낼 테스트 메일을 실제 발송하지 않았습니다.`);
      return { ok: true, message: 'SMTP 미설정 상태라 실제 발송 대신 서버 로그에만 기록했습니다.' };
    }

    try {
      await transporter.sendMail({ from: effective.from, to, subject, text });
      return { ok: true, message: `${to}로 테스트 메일을 보냈습니다.` };
    } catch (err) {
      this.logger.error(`테스트 메일 발송 실패(${to}): ${this.describeError(err)}`);
      return { ok: false, message: `테스트 메일 발송 실패: ${this.describeError(err)}` };
    }
  }

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    const effective = await this.getEffectiveConfig();
    const transporter = this.createTransporter(effective);
    const subject = '[Durunuri OJ] 이메일 인증';
    const text = `아래 링크를 눌러 이메일 인증을 완료하세요 (24시간 내 유효):\n\n${verifyUrl}`;

    if (!transporter) {
      // SMTP 미설정 상태(로컬 개발): 실제 발송 대신 로그로 링크를 남긴다.
      this.logger.warn(`[DEV] SMTP 미설정 - ${to}로 보낼 인증 링크를 대신 로그로 남깁니다: ${verifyUrl}`);
      return;
    }

    await transporter.sendMail({ from: effective.from, to, subject, text });
  }

  private async getEffectiveConfig(): Promise<EffectiveMailConfig> {
    const row = await this.prisma.mailConfig.findUnique({ where: { id: 1 } });
    if (row?.enabled) {
      return {
        source: 'database',
        enabled: true,
        provider: row.provider,
        from: row.from,
        host: row.smtpHost || (row.provider === 'gmail' ? 'smtp.gmail.com' : null),
        port: row.smtpPort,
        secure: row.smtpSecure,
        user: row.smtpUser,
        pass: row.smtpPass,
      };
    }

    const provider = this.config.get<string>('MAIL_PROVIDER', '').toLowerCase();
    const smtpUser = this.config.get<string>('SMTP_USER') || null;
    const host = this.resolveEnvHost(provider);
    const port = this.resolveEnvPort(provider, host);
    return {
      source: host ? 'environment' : 'log-only',
      enabled: !!host,
      provider,
      from: this.config.get<string>('MAIL_FROM', smtpUser ?? 'no-reply@durunuri-oj.local'),
      host,
      port,
      secure: this.config.get<string>('SMTP_SECURE', port === 465 ? 'true' : 'false') === 'true',
      user: smtpUser,
      pass: this.config.get<string>('SMTP_PASS') || null,
    };
  }

  private createTransporter(effective: EffectiveMailConfig): nodemailer.Transporter | null {
    if (!effective.enabled || !effective.host) return null;
    return nodemailer.createTransport({
      host: effective.host,
      port: effective.port ?? 587,
      secure: effective.secure,
      auth: effective.user ? { user: effective.user, pass: effective.pass ?? undefined } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  private resolveEnvHost(provider: string): string | null {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) return host;
    if (provider === 'gmail') return 'smtp.gmail.com';
    return null;
  }

  private resolveEnvPort(provider: string, host: string | null): number | null {
    const raw = this.config.get<string>('SMTP_PORT');
    if (raw) {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 587;
    }
    if (provider === 'gmail') return 587;
    return host ? 587 : null;
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
