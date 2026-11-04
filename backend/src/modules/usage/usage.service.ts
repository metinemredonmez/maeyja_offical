import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';

/** One visitor per IPv4 address or per IPv6 /64: a bot rotating addresses inside its own block still counts once. */
export function visitorKey(ip: string): string {
  const a = ip.trim().replace(/^::ffff:/i, '').split('%')[0].toLowerCase();
  if (!a.includes(':')) return a || 'unknown';
  const [head, tail = ''] = a.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return `${groups.slice(0, 4).map((g) => g || '0').join(':')}::/64`;
}

/**
 * RES-01: e-mails anyone can make the store send — per address (so one inbox can't be flooded) and in total per
 * Istanbul day (so a script can't burn the sender's reputation or the SMTP plan).
 */
export const MAIL_QUOTAS = {
  register: { perAddress: 3, windowMs: 3600_000, daily: 300, label: 'Kayıt e-postası' },
  reset: { perAddress: 3, windowMs: 3600_000, daily: 300, label: 'Şifre sıfırlama e-postası' },
  verify: { perAddress: 3, windowMs: 3600_000, daily: 300, label: 'Doğrulama e-postası' },
  newsletter: { perAddress: 2, windowMs: 86400_000, daily: 2000, label: 'Bülten (kampanya) e-postası' },
  restock: { perAddress: 5, windowMs: 86400_000, daily: 1000, label: 'Stok bildirimi e-postası' },
} as const;
export type MailKind = keyof typeof MAIL_QUOTAS;

/**
 * Quotas (RES-01: the paid AI features, e-mails per address), counted in Postgres so a restart or deploy doesn't hand out a fresh
 * budget. Each call counts one use; it answers false once the limit of its window is passed.
 */
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** One use of `key` in a window of `windowMs` (the window starts with the first use). */
  async take(key: string, limit: number, windowMs: number): Promise<boolean> {
    return (await this.increment(key, windowMs)) <= limit;
  }

  /** The store's budget for the day (Istanbul calendar day); staff are alerted at 80 % and when it runs out. */
  async takeDaily(feature: string, limit: number, label: string): Promise<boolean> {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
    const count = await this.increment(`${feature}:day:${day}`, 26 * 3600_000);
    if (count === Math.ceil(limit * 0.8)) {
      void this.alerts.raise('quota.warning', `${label}: günlük sınırın %80'i kullanıldı (${count} / ${limit}, ${day}).`, { key: feature });
    }
    if (count === limit + 1) {
      this.logger.warn(`${feature}: daily limit of ${limit} reached`);
      void this.alerts.raise('quota.reached', `${label}: günlük sınır (${limit}) doldu; bu özellik yarına kadar çalışmaz. Beklenmedik bir artışsa kötüye kullanım olabilir.`, { key: feature });
    }
    return count <= limit;
  }

  /** One e-mail of `kind` to `address`, if both the address's and the day's quota allow it. */
  async mailToAddress(kind: MailKind, address: string): Promise<boolean> {
    const q = MAIL_QUOTAS[kind];
    return (await this.take(`mail:${kind}:${address}`, q.perAddress, q.windowMs)) && (await this.mailToday(kind));
  }

  /** The day's total for `kind` only (bulk senders check this first and pause until tomorrow). */
  mailToday(kind: MailKind): Promise<boolean> {
    return this.takeDaily(`mail:${kind}`, MAIL_QUOTAS[kind].daily, MAIL_QUOTAS[kind].label);
  }

  /** RES-01c: the admin's AI buttons share one daily budget (the background translator is not counted). */
  async adminTool() {
    if (!(await this.takeDaily('ai-admin', this.config.get('AI_ADMIN_DAILY_LIMIT', { infer: true }), 'Admin AI araçları'))) {
      throw new HttpException('Bugünkü yapay zekâ kullanım sınırı doldu, yarın tekrar deneyin', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sweep() {
    await this.prisma.usageCounter.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }

  /** Atomic: concurrent requests can't both slip under the limit, and an expired window restarts at 1. */
  private async increment(key: string, windowMs: number) {
    const now = new Date();
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "UsageCounter" ("key", "count", "expiresAt") VALUES (${key}, 1, ${new Date(now.getTime() + windowMs)})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "UsageCounter"."expiresAt" <= ${now} THEN 1 ELSE "UsageCounter"."count" + 1 END,
        "expiresAt" = CASE WHEN "UsageCounter"."expiresAt" <= ${now} THEN EXCLUDED."expiresAt" ELSE "UsageCounter"."expiresAt" END
      RETURNING "count"`;
    return Number(rows[0]?.count ?? 0);
  }
}
