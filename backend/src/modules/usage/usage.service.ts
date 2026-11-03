import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { templates } from '../notifications/mail.templates';

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
 * Quotas (RES-01: the paid AI features, e-mails per address), counted in Postgres so a restart or deploy doesn't hand out a fresh
 * budget. Each call counts one use; it answers false once the limit of its window is passed.
 */
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** One use of `key` in a window of `windowMs` (the window starts with the first use). */
  async take(key: string, limit: number, windowMs: number): Promise<boolean> {
    return (await this.increment(key, windowMs)) <= limit;
  }

  /** The store's budget for the day (Istanbul calendar day); the admin hears once when 80 % is used. */
  async takeDaily(feature: string, limit: number, label: string): Promise<boolean> {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
    const count = await this.increment(`${feature}:day:${day}`, 26 * 3600_000);
    if (count === Math.ceil(limit * 0.8)) {
      void this.mail.sendToAdmin(templates.adminNotice(`${label}: günlük sınırın %80'i kullanıldı`, { Kullanım: `${count} / ${limit}`, Gün: day }));
    }
    if (count === limit + 1) this.logger.warn(`${feature}: daily limit of ${limit} reached`);
    return count <= limit;
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
