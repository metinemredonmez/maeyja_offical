import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Env } from '../../config/env.validation';
import { MailContent } from './mail.templates';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const host = this.config.get('SMTP_HOST', { infer: true });
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: this.config.get('SMTP_PORT', { infer: true }),
          secure: this.config.get('SMTP_SECURE', { infer: true }),
          auth: { user: this.config.get('SMTP_USER', { infer: true }), pass: this.config.get('SMTP_PASS', { infer: true }) },
        })
      : null;
    if (!host) this.logger.warn('SMTP_HOST not set — emails are logged instead of sent');
  }

  /** False when SMTP is not configured (emails are only logged). */
  get enabled() {
    return this.transporter !== null;
  }

  /** For bulk sends: throws on failure so the caller can record the error per recipient. */
  async deliver(to: string, content: MailContent, headers?: Record<string, string>) {
    if (!this.transporter) throw new Error('SMTP ayarlı değil');
    await this.transporter.sendMail({
      from: this.config.get('MAIL_FROM', { infer: true }),
      replyTo: this.config.get('MAIL_REPLY_TO', { infer: true }) || undefined,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      headers,
    });
  }

  /** Never throws: a failed email must not fail the request that triggered it. */
  async send(to: string | undefined | null, content: MailContent): Promise<boolean> {
    if (!to) return false;
    if (!this.transporter) {
      this.logger.log(`[mail:dry-run] to=${to} subject="${content.subject}"`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.config.get('MAIL_FROM', { infer: true }),
      replyTo: this.config.get('MAIL_REPLY_TO', { infer: true }) || undefined,
        to,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      return true;
    } catch (e) {
      this.logger.error(`mail to ${to} failed: ${(e as Error).message}`);
      return false;
    }
  }

  sendToAdmin(content: MailContent) {
    return this.send(this.config.get('ADMIN_NOTIFY_EMAIL', { infer: true }), content);
  }
}
