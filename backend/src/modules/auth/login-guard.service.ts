import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

const WINDOW_MS = 15 * 60_000;
/** First lock; every further lock of the same key lasts twice as long, up to a day. */
const LOCK_MS = 15 * 60_000;
const LOCK_MAX_MS = 24 * 3600_000;
/** One account from one address: the usual guessing case. */
const MAX_PER_ACCOUNT_IP = 5;
/** One account from many addresses (distributed guessing); high enough that one attacker can't lock the owner out. */
const MAX_PER_ACCOUNT = 50;
const MAX_PER_IP = 20;

/**
 * Brute-force protection for the password step on top of the global and nginx rate limits (AUT-02). Failures are
 * counted per account+IP, per account and per IP, so someone who only knows an e-mail address can't lock its owner
 * out from their own network. Counters live in Postgres (LoginAttempt): a deploy doesn't hand out fresh guesses.
 * The second factor keeps its own counter on the account (MfaService).
 */
@Injectable()
export class LoginGuardService {
  private readonly logger = new Logger(LoginGuardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Throws 429 while a key is locked. Call before checking credentials. */
  assertAllowed(email: string, ip: string) {
    return this.assert([`ui:${email}|${ip}`, `u:${email}`, `ip:${ip}`]);
  }

  /** For the second step: only the address is limited here. */
  assertIpAllowed(ip: string) {
    return this.assert([`ip:${ip}`]);
  }

  async recordFailure(email: string, ip: string) {
    await this.bump(`ui:${email}|${ip}`, MAX_PER_ACCOUNT_IP, `account ${email} from ${ip}`);
    await this.bump(`u:${email}`, MAX_PER_ACCOUNT, `account ${email}`);
    await this.recordIpFailure(ip);
  }

  recordIpFailure(ip: string) {
    return this.bump(`ip:${ip}`, MAX_PER_IP, `ip ${ip}`);
  }

  /** The account-wide count is left to expire: a right password elsewhere mustn't reset a distributed attack. */
  async recordSuccess(email: string, ip: string) {
    await this.prisma.loginAttempt.deleteMany({ where: { key: `ui:${email}|${ip}` } });
  }

  /** Old counters go; the lock history of a key is forgotten after two quiet days. */
  @Cron(CronExpression.EVERY_HOUR)
  async sweep() {
    const quiet = new Date(Date.now() - 2 * 86400_000);
    await this.prisma.loginAttempt.deleteMany({ where: { updatedAt: { lt: quiet }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] } });
  }

  private async assert(keys: string[]) {
    const locked = await this.prisma.loginAttempt.findMany({ where: { key: { in: keys }, lockedUntil: { gt: new Date() } }, select: { lockedUntil: true } });
    if (!locked.length) return;
    const until = Math.max(...locked.map((l) => l.lockedUntil!.getTime()));
    const retryAfter = Math.ceil((until - Date.now()) / 1000);
    throw new HttpException(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: `Çok fazla başarısız deneme. ${Math.ceil(retryAfter / 60)} dakika sonra tekrar deneyin.`, retryAfter },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async bump(key: string, max: number, label: string) {
    const now = new Date();
    let row = await this.prisma.loginAttempt.upsert({ where: { key }, create: { key, failures: 1, firstAt: now }, update: { failures: { increment: 1 } } });
    if (now.getTime() - row.firstAt.getTime() > WINDOW_MS) {
      row = await this.prisma.loginAttempt.update({ where: { key }, data: { failures: 1, firstAt: now } });
    }
    if (row.failures < max) return;
    const ms = Math.min(LOCK_MS * 2 ** row.locks, LOCK_MAX_MS);
    await this.prisma.loginAttempt.update({ where: { key }, data: { failures: 0, firstAt: now, locks: { increment: 1 }, lockedUntil: new Date(now.getTime() + ms) } });
    this.logger.warn(`login locked for ${label} for ${ms / 60_000} min (${max} failures in window)`);
  }
}
