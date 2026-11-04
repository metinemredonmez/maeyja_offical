import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Alert, AlertLevel, Prisma } from '@prisma/client';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { templates } from '../notifications/mail.templates';
import { SettingsService } from '../settings/settings.service';
import { ALERT_CATALOG, AlertCode, maskEmail, maskEmails, webhookAllowed } from './alert-catalog';

const RETENTION_DAYS = 90;
/** LOG-03: raises the database couldn't take are kept for the next try, but never more than this many. */
const BUFFER_MAX = 100;

type Pending = { code: AlertCode; key: string; detail: string; meta?: Record<string, unknown>; at: Date; notified: boolean };
type Deliverable = Pick<Alert, 'key' | 'title' | 'detail' | 'count' | 'firstAt'> & { code: AlertCode; level: AlertLevel };

/**
 * Tells staff when something needs them (LOG-04): failed payments, a mailbox that stopped syncing, a quota that ran
 * out, a staff account whose second factor was removed… Each open problem is one row (code + key); repeats count up
 * on it and are mailed at most once per the code's window. `raise` never throws, so an alert can't break the work
 * that raised it; while the database is down the alert still goes out, and is written once it is back.
 */
@Injectable()
export class AlertsService implements OnModuleInit {
  private readonly logger = new Logger(AlertsService.name);
  private buffer: Pending[] = [];
  /** Last delivery per open problem while the database can't tell, so an outage doesn't mail on every raise. */
  private readonly sentWhileDown = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit() {
    // MailService can't inject us (alerts go out through it), so it reports failed e-mails here.
    this.mail.onFailure((subject, error) => void this.raise('mail.send_failed', `"${subject}" gönderilemedi: ${error}`));
  }

  async raise(code: AlertCode, detail: string, opts: { key?: string; meta?: Record<string, unknown> } = {}): Promise<void> {
    const def = ALERT_CATALOG[code];
    const key = (opts.key ?? '').slice(0, 200);
    const text = maskEmails(detail).slice(0, 2000);
    this.logger.warn(`alert ${code}${key ? ` [${key}]` : ''}: ${text}`);
    try {
      const row = await this.store({ code, key, detail: text, meta: opts.meta, at: new Date(), notified: false });
      if (def.level === 'INFO') return;
      // Claim the delivery: of two raises at the same moment only one sends.
      const cutoff = new Date(Date.now() - def.repeatMin * 60_000);
      const claimed = await this.prisma.alert.updateMany({
        where: { id: row.id, OR: [{ notifiedAt: null }, { notifiedAt: { lt: cutoff } }] },
        data: { notifiedAt: new Date() },
      });
      if (claimed.count) await this.deliver({ ...row, code });
    } catch (e) {
      this.logger.error(`alert ${code} could not be stored: ${(e as Error).message}`);
      const openKey = `${code}|${key}`;
      const due = def.level !== 'INFO' && Date.now() - (this.sentWhileDown.get(openKey) ?? 0) > def.repeatMin * 60_000;
      if (due) this.sentWhileDown.set(openKey, Date.now());
      if (this.buffer.length < BUFFER_MAX) this.buffer.push({ code, key, detail: text, meta: opts.meta, at: new Date(), notified: due });
      if (due) await this.deliver({ code, key, level: def.level, title: def.title, detail: text, count: 1, firstAt: new Date() }).catch(() => undefined);
    }
  }

  /** The problem went away by itself (the mailbox syncs again…). Costs one indexed update when nothing is open. */
  async clear(code: AlertCode, key = '') {
    await this.prisma.alert
      .updateMany({ where: { openKey: `${code}|${key}` }, data: { openKey: null, resolvedAt: new Date() } })
      .catch((e: Error) => this.logger.warn(`alert ${code} not cleared: ${e.message}`));
  }

  /** Admin → Uyarılar → "Deneme gönder": both channels right now, and what each of them said. */
  async test() {
    const cfg = await this.settings.get('alerts');
    const to = cfg.email || this.config.get('ADMIN_NOTIFY_EMAIL', { infer: true });
    const lines = { Ayrıntı: 'Bu bir deneme uyarısıdır; gerçek bir sorun yok.', Panel: this.panelUrl };
    const email = to ? await this.mail.send(to, templates.adminNotice('Deneme: uyarılar çalışıyor', lines), false) : false;
    const webhook = cfg.webhookUrl ? await this.postWebhook(cfg.webhookUrl, `Deneme: uyarılar çalışıyor\n${this.panelUrl}`) : null;
    return { smtp: this.mail.enabled, emailTo: to ? maskEmail(to) : null, email, webhook };
  }

  /** Alerts the database couldn't take are written now (already delivered ones stay quiet). */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async flush() {
    while (this.buffer.length) {
      try {
        await this.store(this.buffer[0]);
        this.buffer.shift();
      } catch {
        return; // still down
      }
    }
    this.sentWhileDown.clear();
  }

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async sweep() {
    const { count } = await this.prisma.alert.deleteMany({ where: { resolvedAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86400_000) } } });
    if (count) this.logger.log(`deleted ${count} resolved alert(s) older than ${RETENTION_DAYS} days`);
  }

  /** One row per open problem; Prisma runs this as a native upsert on the unique `openKey`, so racing raises merge. */
  private store(p: Pending) {
    const def = ALERT_CATALOG[p.code];
    const meta = p.meta as Prisma.InputJsonValue | undefined;
    return this.prisma.alert.upsert({
      where: { openKey: `${p.code}|${p.key}` },
      create: {
        code: p.code,
        key: p.key,
        openKey: `${p.code}|${p.key}`,
        level: def.level,
        title: def.title,
        detail: p.detail,
        meta,
        firstAt: p.at,
        lastAt: p.at,
        notifiedAt: p.notified ? p.at : null,
      },
      update: { count: { increment: 1 }, lastAt: p.at, detail: p.detail, ...(meta ? { meta } : {}) },
    });
  }

  private async deliver(a: Deliverable) {
    let cfg = { email: '', webhookUrl: '', muted: [] as string[] };
    try {
      cfg = await this.settings.get('alerts');
    } catch {
      // Database down: fall back to ADMIN_NOTIFY_EMAIL.
    }
    if (cfg.muted.includes(a.code)) return;
    const to = cfg.email || this.config.get('ADMIN_NOTIFY_EMAIL', { infer: true });
    const subject = `${a.level === AlertLevel.CRITICAL ? 'Acil' : 'Uyarı'}: ${a.title}`;
    const lines: Record<string, unknown> = { Ayrıntı: a.detail };
    if (a.key) lines['Kayıt'] = a.key;
    if (a.count > 1) lines['Kaç kez'] = a.count;
    lines['İlk görülme'] = a.firstAt.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    lines['Panel'] = this.panelUrl;
    await Promise.all([
      to ? this.mail.send(to, templates.adminNotice(subject, lines), false) : null,
      cfg.webhookUrl ? this.postWebhook(cfg.webhookUrl, `${subject}\n${a.detail}\n${this.panelUrl}`) : null,
    ]);
  }

  /** EXT-01/02: an allowed chat host only, over https, no redirects, a short timeout; the URL (a secret) is never logged. */
  private async postWebhook(url: string, text: string): Promise<boolean> {
    if (!webhookAllowed(url)) return false;
    const body = new URL(url).hostname.startsWith('discord') ? { content: text.slice(0, 1900) } : { text: text.slice(0, 3000) };
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(5000) });
      if (!r.ok) this.logger.warn(`alert webhook answered ${r.status}`);
      return r.ok;
    } catch (e) {
      this.logger.warn(`alert webhook failed: ${(e as Error).message}`);
      return false;
    }
  }

  private get panelUrl() {
    return `${this.config.get('ADMIN_URL', { infer: true })}/alerts`;
  }
}
