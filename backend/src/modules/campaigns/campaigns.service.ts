import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignAudience, CampaignRecipientStatus, CampaignStatus, EmailCampaign, EmailCampaignRecipient, Prisma, UserRole } from '@prisma/client';
import { paginate, PaginationQueryDto, skipTake } from '../../common/dto/pagination.dto';
import { keyFromEnv } from '../../common/utils/crypto.util';
import { cleanCmsHtml } from '../../common/utils/html.util';
import { storefrontPath } from '../../common/utils/i18n.util';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { SettingsService } from '../settings/settings.service';
import { renderCampaign, unsubscribeSignature, verifyUnsubscribeSignature } from './campaign.mail';
import { AudienceQueryDto, CampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

/** ~100 emails a minute: stays under Resend's default 2 requests/second. */
const SEND_INTERVAL_MS = 600;
const BATCH = 25;
/** Test sends use this pseudo recipient so their unsubscribe link works without touching real data. */
const TEST_RECIPIENT = 'test';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  private readonly key: Buffer;
  /** Campaigns being sent by this process (single pm2 instance, so an in-memory lock is enough). */
  private readonly active = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.key = keyFromEnv(config.get('APP_ENCRYPTION_KEY', { infer: true }), config.get('JWT_ACCESS_SECRET', { infer: true }));
  }

  // ───────── admin CRUD ─────────

  async list(q: PaginationQueryDto) {
    const where: Prisma.EmailCampaignWhereInput = q.q ? { subject: { contains: q.q, mode: 'insensitive' } } : {};
    const [items, total] = await Promise.all([
      this.prisma.emailCampaign.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.emailCampaign.count({ where }),
    ]);
    return { ...paginate(items, total, q.page, q.limit), mailEnabled: this.mail.enabled };
  }

  async get(id: string) {
    const campaign = await this.prisma.emailCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Kampanya bulunamadı');
    const [pending, failures] = await Promise.all([
      this.prisma.emailCampaignRecipient.count({ where: { campaignId: id, status: CampaignRecipientStatus.PENDING } }),
      this.prisma.emailCampaignRecipient.findMany({
        where: { campaignId: id, status: CampaignRecipientStatus.FAILED },
        select: { email: true, error: true },
        take: 20,
      }),
    ]);
    return { ...campaign, pendingCount: pending, failures, mailEnabled: this.mail.enabled };
  }

  create(dto: CampaignDto, userId: string) {
    return this.prisma.emailCampaign.create({ data: { ...this.clean(dto), subject: dto.subject, body: cleanCmsHtml(dto.body) ?? '', createdById: userId } });
  }

  async update(id: string, dto: UpdateCampaignDto) {
    await this.draft(id);
    return this.prisma.emailCampaign.update({ where: { id }, data: this.clean(dto) });
  }

  async remove(id: string) {
    const c = await this.find(id);
    if (c.status === CampaignStatus.SENDING) throw new BadRequestException('Gönderimdeki kampanya silinemez; önce durdurun');
    await this.prisma.emailCampaign.delete({ where: { id } });
    return { ok: true };
  }

  /** How many people would receive it right now. */
  async audienceCount(q: AudienceQueryDto) {
    const list = await this.resolveAudience(q.audience ?? CampaignAudience.ALL, q.locale ?? null);
    return { count: list.length, mailEnabled: this.mail.enabled };
  }

  // ───────── sending ─────────

  async sendTest(id: string, to: string) {
    const campaign = await this.find(id);
    this.assertMail();
    const { content, headers } = await this.render(campaign, { id: TEST_RECIPIENT, locale: campaign.locale ?? 'tr' });
    try {
      await this.mail.deliver(to, { ...content, subject: `[TEST] ${content.subject}` }, headers);
    } catch (e) {
      throw new BadRequestException(`Test e-postası gönderilemedi: ${(e as Error).message}`);
    }
    return { ok: true, to };
  }

  /** Freezes the audience into recipient rows, then sends in the background. */
  async send(id: string) {
    const campaign = await this.draft(id);
    this.assertMail();
    const audience = await this.resolveAudience(campaign.audience, campaign.locale);
    if (!audience.length) throw new BadRequestException('Bu hedef kitlede izinli alıcı yok');
    await this.prisma.$transaction([
      this.prisma.emailCampaignRecipient.createMany({ data: audience.map((a) => ({ campaignId: id, email: a.email, locale: a.locale })), skipDuplicates: true }),
      this.prisma.emailCampaign.update({ where: { id }, data: { status: CampaignStatus.SENDING, totalRecipients: audience.length, startedAt: new Date() } }),
    ]);
    this.logger.log(`campaign ${id} queued for ${audience.length} recipients`);
    void this.process(id);
    return this.get(id);
  }

  async cancel(id: string) {
    const c = await this.find(id);
    if (c.status !== CampaignStatus.SENDING && c.status !== CampaignStatus.DRAFT) throw new BadRequestException('Bu kampanya durdurulamaz');
    await this.prisma.$transaction([
      this.prisma.emailCampaign.update({ where: { id }, data: { status: CampaignStatus.CANCELLED, finishedAt: new Date() } }),
      this.prisma.emailCampaignRecipient.updateMany({ where: { campaignId: id, status: CampaignRecipientStatus.PENDING }, data: { status: CampaignRecipientStatus.SKIPPED } }),
    ]);
    return this.get(id);
  }

  /** Picks up campaigns left half-sent by a restart or deploy. */
  @Cron(CronExpression.EVERY_MINUTE)
  async resume() {
    const sending = await this.prisma.emailCampaign.findMany({ where: { status: CampaignStatus.SENDING }, select: { id: true } });
    for (const c of sending) void this.process(c.id);
  }

  private async process(id: string) {
    if (this.active.has(id)) return;
    this.active.add(id);
    try {
      for (;;) {
        const campaign = await this.prisma.emailCampaign.findUnique({ where: { id } });
        if (!campaign || campaign.status !== CampaignStatus.SENDING) return; // cancelled or deleted
        const batch = await this.prisma.emailCampaignRecipient.findMany({
          where: { campaignId: id, status: CampaignRecipientStatus.PENDING },
          orderBy: { id: 'asc' },
          take: BATCH,
        });
        if (!batch.length) break;
        for (const r of batch) {
          const { content, headers } = await this.render(campaign, r);
          try {
            await this.mail.deliver(r.email, content, headers);
            await this.prisma.$transaction([
              this.prisma.emailCampaignRecipient.update({ where: { id: r.id }, data: { status: CampaignRecipientStatus.SENT, sentAt: new Date() } }),
              this.prisma.emailCampaign.update({ where: { id }, data: { sentCount: { increment: 1 } } }),
            ]);
          } catch (e) {
            await this.prisma.$transaction([
              this.prisma.emailCampaignRecipient.update({ where: { id: r.id }, data: { status: CampaignRecipientStatus.FAILED, error: (e as Error).message.slice(0, 500) } }),
              this.prisma.emailCampaign.update({ where: { id }, data: { failedCount: { increment: 1 } } }),
            ]);
          }
          await sleep(SEND_INTERVAL_MS);
        }
      }
      await this.prisma.emailCampaign.updateMany({ where: { id, status: CampaignStatus.SENDING }, data: { status: CampaignStatus.SENT, finishedAt: new Date() } });
      this.logger.log(`campaign ${id} finished`);
    } catch (e) {
      this.logger.error(`campaign ${id} stopped: ${(e as Error).message}`); // the minute job resumes it
    } finally {
      this.active.delete(id);
    }
  }

  // ───────── unsubscribe (public) ─────────

  async unsubscribe(recipientId: string, signature: string) {
    if (!verifyUnsubscribeSignature(recipientId, signature, this.key)) throw new BadRequestException('Bağlantı geçersiz');
    if (recipientId === TEST_RECIPIENT) return { ok: true };
    const r = await this.prisma.emailCampaignRecipient.findUnique({ where: { id: recipientId }, select: { email: true } });
    if (!r) throw new BadRequestException('Bağlantı geçersiz');
    const email = r.email.toLowerCase();
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.newsletterSubscriber.upsert({ where: { email }, create: { email, source: 'unsubscribe', unsubscribedAt: now }, update: { unsubscribedAt: now } }),
      this.prisma.user.updateMany({ where: { email: { equals: email, mode: 'insensitive' } }, data: { marketingOptIn: false } }),
    ]);
    this.logger.log('newsletter unsubscribe via campaign link');
    return { ok: true };
  }

  // ───────── helpers ─────────

  /** Everyone with marketing consent in the chosen group, de-duplicated; anyone who unsubscribed is excluded. */
  private async resolveAudience(audience: CampaignAudience, locale: string | null) {
    const byLocale = locale ? { locale } : {};
    const out = new Map<string, string>();
    if (audience !== CampaignAudience.CUSTOMERS) {
      const subs = await this.prisma.newsletterSubscriber.findMany({ where: { unsubscribedAt: null, ...byLocale }, select: { email: true, locale: true } });
      for (const s of subs) out.set(s.email.toLowerCase(), s.locale);
    }
    if (audience !== CampaignAudience.SUBSCRIBERS) {
      const [customers, optedOut] = await Promise.all([
        this.prisma.user.findMany({
          where: { role: UserRole.CUSTOMER, marketingOptIn: true, isActive: true, deletedAt: null, ...byLocale },
          select: { email: true, locale: true },
        }),
        this.prisma.newsletterSubscriber.findMany({ where: { unsubscribedAt: { not: null } }, select: { email: true } }),
      ]);
      const blocked = new Set(optedOut.map((s) => s.email.toLowerCase()));
      for (const u of customers) {
        const email = u.email.toLowerCase();
        if (!blocked.has(email)) out.set(email, u.locale);
      }
    }
    return [...out].map(([email, l]) => ({ email, locale: l }));
  }

  private async render(campaign: EmailCampaign, recipient: Pick<EmailCampaignRecipient, 'id' | 'locale'>) {
    const store = await this.settings.get('store');
    const web = this.config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
    const api = `${this.config.get('API_URL', { infer: true }).replace(/\/$/, '')}/${this.config.get('API_PREFIX', { infer: true })}`;
    const query = `r=${encodeURIComponent(recipient.id)}&t=${unsubscribeSignature(recipient.id, this.key)}`;
    const content = renderCampaign(campaign, {
      locale: recipient.locale,
      unsubscribeUrl: `${web}${storefrontPath(recipient.locale, `/unsubscribe?${query}`)}`,
      webUrl: web,
      sender: { name: store.name, address: store.address, email: store.email },
    });
    // RFC 8058 one-click unsubscribe — required by Gmail/Yahoo for bulk senders.
    const headers = { 'List-Unsubscribe': `<${api}/newsletter/unsubscribe/one-click?${query}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
    return { content, headers };
  }

  private clean(dto: UpdateCampaignDto) {
    const { body, ...rest } = dto;
    return { ...rest, ...(body !== undefined ? { body: cleanCmsHtml(body) ?? '' } : {}) };
  }

  private async find(id: string) {
    const c = await this.prisma.emailCampaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Kampanya bulunamadı');
    return c;
  }

  private async draft(id: string) {
    const c = await this.find(id);
    if (c.status !== CampaignStatus.DRAFT) throw new BadRequestException('Yalnızca taslak kampanyalar düzenlenip gönderilebilir');
    return c;
  }

  private assertMail() {
    if (!this.mail.enabled) throw new BadRequestException('E-posta (SMTP) ayarlı değil — önce backend .env içindeki SMTP_* alanlarını doldurun');
  }
}
