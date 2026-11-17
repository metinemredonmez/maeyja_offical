import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, UserRole } from '@prisma/client';
import { keyFromEnv } from '../../common/utils/crypto.util';
import { storefrontPath } from '../../common/utils/i18n.util';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { Tracked } from '../cron/tracked.decorator';
import { MailService } from '../notifications/mail.service';
import { PAID_STATUSES } from '../orders/order-lifecycle.service';
import { SettingsService } from '../settings/settings.service';
import { SettingValue } from '../settings/settings.defaults';
import { UsageService } from '../usage/usage.service';
import { AUTOMATION_PREFIX, Flow, FLOW_SETTING, FLOWS, renderAutomation } from './automation.mail';
import { unsubscribeSignature } from './campaign.mail';

/** Per flow and run (hourly): a slow, steady trickle that stays well inside the SMTP plan. */
const BATCH = 50;
const DAY = 86400_000;
/** When each flow was switched on (internal; not an admin setting): nobody from before that gets a backlog. */
const STATE_KEY = 'mailAutomationState';
/** Test sends use the campaigns' pseudo recipient, whose unsubscribe link works without touching real data. */
const TEST_RECIPIENT = 'test';

type Recipient = { email: string; refId: string; locale: string; name: string | null };
type FlowConfig = SettingValue<'mailWelcome'> & Partial<SettingValue<'mailAfterPurchase'>> & Partial<SettingValue<'mailWinback'>>;

/**
 * Automatic e-mails (Admin → Otomatik e-postalar), each off until switched on:
 * - welcome: a new newsletter subscriber;
 * - after purchase: some days after the order was shipped — care guide, a word back from the customer;
 * - win-back: a customer whose last order is older than the set number of days, at most once in that time.
 * Only people who may get marketing (unless the admin lets the after-purchase e-mail go to every buyer), never anyone
 * who unsubscribed; every e-mail carries a signed unsubscribe link. Nothing runs without SMTP.
 */
@Injectable()
export class MailAutomationsService {
  private readonly logger = new Logger(MailAutomationsService.name);
  private readonly key: Buffer;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly usage: UsageService,
    private readonly alerts: AlertsService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.key = keyFromEnv(config.get('APP_ENCRYPTION_KEY', { infer: true }), config.get('JWT_ACCESS_SECRET', { infer: true }));
  }

  @Cron(CronExpression.EVERY_HOUR)
  @Tracked('mail.automations', { label: 'Otomatik e-postalar', everyMin: 60 })
  async run() {
    if (this.running) return { skipped: 'running' };
    if (!this.mail.enabled) return { skipped: 'smtp' };
    this.running = true;
    try {
      const state = await this.state();
      const sent: Record<string, number> = {};
      let failed = 0;
      for (const flow of FLOWS) {
        const cfg = (await this.settings.get(FLOW_SETTING[flow])) as FlowConfig;
        if (!cfg.enabled) {
          delete state[flow];
          continue;
        }
        state[flow] ??= new Date().toISOString();
        const coupon = flow === 'winback' ? await this.coupon(cfg.coupon ?? '') : null;
        if (coupon === false) continue;
        sent[flow] = 0;
        for (const r of await this.recipients(flow, cfg, new Date(state[flow]!))) {
          const outcome = await this.send(flow, cfg, r, coupon || null);
          if (outcome === 'sent') sent[flow]++;
          if (outcome === 'failed') failed++;
          if (outcome === 'quota') break;
        }
      }
      const value = state as Prisma.InputJsonValue;
      await this.prisma.setting.upsert({ where: { key: STATE_KEY }, create: { key: STATE_KEY, value }, update: { value } });
      if (failed) void this.alerts.raise('campaign.failed', `Otomatik e-postalar: ${failed} e-posta gönderilemedi. Ayrıntı Zamanlanmış işler → Otomatik e-postalar geçmişinde.`, { key: 'automations' });
      return { ...sent, failed };
    } finally {
      this.running = false;
    }
  }

  /** Admin → "Deneme gönder": the flow's e-mail to the admin's own address, with a sample name; nothing is recorded. */
  async test(flow: Flow, to: string, name: string | null) {
    if (!this.mail.enabled) throw new BadRequestException('SMTP ayarlı değil; e-posta gönderilemiyor');
    const cfg = (await this.settings.get(FLOW_SETTING[flow])) as FlowConfig;
    const { content, headers } = await this.render(flow, cfg, { email: to, refId: '', locale: 'tr', name }, cfg.coupon || null, TEST_RECIPIENT);
    await this.mail.deliver(to, { ...content, subject: `[Deneme] ${content.subject}` }, headers);
    return { ok: true };
  }

  /** Last 30 days per flow, for the admin page. */
  async stats() {
    const rows = await this.prisma.mailAutomationSend.groupBy({ by: ['flow', 'status'], where: { sentAt: { gte: new Date(Date.now() - 30 * DAY) } }, _count: true });
    const out = Object.fromEntries(FLOWS.map((f) => [f, { sent: 0, failed: 0 }])) as Record<Flow, { sent: number; failed: number }>;
    for (const r of rows) {
      const f = out[r.flow as Flow];
      if (!f) continue;
      if (r.status === 'SENT') f.sent += r._count;
      if (r.status === 'FAILED') f.failed += r._count;
    }
    return { smtp: this.mail.enabled, flows: out };
  }

  // ───────── who gets what ─────────

  private async recipients(flow: Flow, cfg: FlowConfig, since: Date): Promise<Recipient[]> {
    const now = Date.now();
    let list: Recipient[];
    if (flow === 'welcome') {
      const subs = await this.prisma.newsletterSubscriber.findMany({ where: { unsubscribedAt: null, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' }, take: BATCH * 2 });
      const names = await this.firstNames(subs.map((s) => s.email));
      list = subs.map((s) => ({ email: s.email, refId: '', locale: s.locale, name: names.get(s.email.toLowerCase()) ?? null }));
    } else if (flow === 'afterPurchase') {
      const delay = (cfg.delayDays ?? 10) * DAY;
      // Orders that reach "delay days after shipping" from the moment the flow was switched on.
      const orders = await this.prisma.order.findMany({
        where: { status: { in: ['SHIPPED', 'DELIVERED'] }, shippedAt: { gte: new Date(since.getTime() - delay), lte: new Date(now - delay) } },
        orderBy: { shippedAt: 'asc' },
        take: BATCH * 2,
        select: { id: true, email: true, locale: true, shippingAddress: true, user: { select: { firstName: true, marketingOptIn: true } } },
      });
      const consented = cfg.onlyConsented === false ? null : await this.subscribed(orders.map((o) => o.email));
      list = orders
        .filter((o) => !consented || o.user?.marketingOptIn || consented.has(o.email.toLowerCase()))
        .map((o) => ({ email: o.email, refId: o.id, locale: o.locale, name: o.user?.firstName ?? (o.shippingAddress as { firstName?: string } | null)?.firstName ?? null }));
    } else {
      const days = cfg.afterDays ?? 180;
      const cutoff = new Date(now - days * DAY);
      const users = await this.prisma.user.findMany({
        where: {
          role: UserRole.CUSTOMER,
          isActive: true,
          deletedAt: null,
          marketingOptIn: true,
          emailVerifiedAt: { not: null },
          orders: { some: { status: { in: PAID_STATUSES } }, none: { status: { in: PAID_STATUSES }, createdAt: { gt: cutoff } } },
        },
        take: BATCH * 2,
        select: { email: true, firstName: true, locale: true },
      });
      // At most once per `days`: whoever heard from us within that time is left out.
      const recent = new Set(
        (await this.prisma.mailAutomationSend.findMany({ where: { flow: 'winback', email: { in: users.map((u) => u.email) }, sentAt: { gt: cutoff } }, select: { email: true } })).map((s) => s.email),
      );
      const period = `p${Math.floor(now / (days * DAY))}`;
      list = users.filter((u) => !recent.has(u.email)).map((u) => ({ email: u.email, refId: period, locale: u.locale, name: u.firstName }));
    }
    // Never anyone who unsubscribed, and nobody twice.
    const out = await this.unsubscribed(list.map((r) => r.email));
    const done = new Set(
      (await this.prisma.mailAutomationSend.findMany({ where: { flow, email: { in: list.map((r) => r.email) } }, select: { email: true, refId: true } })).map((s) => `${s.email}|${s.refId}`),
    );
    return list.filter((r) => !out.has(r.email.toLowerCase()) && !done.has(`${r.email}|${r.refId}`)).slice(0, BATCH);
  }

  private async send(flow: Flow, cfg: FlowConfig, r: Recipient, coupon: string | null): Promise<'sent' | 'failed' | 'skipped' | 'quota'> {
    if (!(await this.usage.mailToday('automation'))) return 'quota';
    if (!(await this.usage.take(`mail:automation:${r.email.toLowerCase()}`, 2, DAY))) return 'skipped';
    let id: string;
    try {
      id = (await this.prisma.mailAutomationSend.create({ data: { flow, email: r.email, refId: r.refId, locale: r.locale } })).id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'skipped'; // sent meanwhile
      throw e;
    }
    try {
      const { content, headers } = await this.render(flow, cfg, r, coupon, `${AUTOMATION_PREFIX}${id}`);
      await this.mail.deliver(r.email, content, headers);
      await this.prisma.mailAutomationSend.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } });
      return 'sent';
    } catch (e) {
      await this.prisma.mailAutomationSend.update({ where: { id }, data: { status: 'FAILED', error: (e as Error).message.slice(0, 500) } });
      return 'failed';
    }
  }

  private async render(flow: Flow, cfg: FlowConfig, r: Recipient, coupon: string | null, recipientId: string) {
    const store = await this.settings.get('store');
    const web = this.config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
    const api = `${this.config.get('API_URL', { infer: true }).replace(/\/$/, '')}/${this.config.get('API_PREFIX', { infer: true })}`;
    const query = `r=${encodeURIComponent(recipientId)}&t=${unsubscribeSignature(recipientId, this.key)}`;
    const content = renderAutomation(flow, cfg, { name: r.name, coupon }, {
      locale: r.locale,
      unsubscribeUrl: `${web}${storefrontPath(r.locale, `/unsubscribe?${query}`)}`,
      webUrl: web,
      sender: { name: store.name, address: store.address, email: store.email },
    });
    // RFC 8058 one-click unsubscribe, as for campaigns.
    return { content, headers: { 'List-Unsubscribe': `<${api}/newsletter/unsubscribe/one-click?${query}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
  }

  // ───────── helpers ─────────

  /** The win-back code, if one is set: it must exist and be valid, else the flow waits and staff hear about it. */
  private async coupon(code: string): Promise<string | null | false> {
    if (!code) return null;
    const now = new Date();
    const c = await this.prisma.coupon.findFirst({
      where: { code: { equals: code, mode: 'insensitive' }, isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
      select: { code: true },
    });
    if (c) return c.code;
    void this.alerts.raise('campaign.stopped', `Geri çağırma e-postası bekliyor: ${code} kuponu yok, kapalı ya da süresi dolmuş. Otomatik e-postalar sayfasından kuponu değiştirin.`, { key: 'winback-coupon' });
    return false;
  }

  private async state(): Promise<Partial<Record<Flow, string>>> {
    const row = await this.prisma.setting.findUnique({ where: { key: STATE_KEY } });
    return { ...((row?.value as Partial<Record<Flow, string>> | null) ?? {}) };
  }

  private async firstNames(emails: string[]) {
    const users = await this.prisma.user.findMany({ where: { email: { in: emails, mode: 'insensitive' } }, select: { email: true, firstName: true } });
    return new Map(users.filter((u) => u.firstName).map((u) => [u.email.toLowerCase(), u.firstName!]));
  }

  private async subscribed(emails: string[]) {
    const subs = await this.prisma.newsletterSubscriber.findMany({ where: { email: { in: emails, mode: 'insensitive' }, unsubscribedAt: null }, select: { email: true } });
    return new Set(subs.map((s) => s.email.toLowerCase()));
  }

  private async unsubscribed(emails: string[]) {
    const subs = await this.prisma.newsletterSubscriber.findMany({ where: { email: { in: emails, mode: 'insensitive' }, unsubscribedAt: { not: null } }, select: { email: true } });
    return new Set(subs.map((s) => s.email.toLowerCase()));
  }
}
