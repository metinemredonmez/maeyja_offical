import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

interface Bucket {
  failures: number;
  firstAt: number;
  lockedUntil: number;
}

const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;
const MAX_PER_ACCOUNT = 5;
const MAX_PER_IP = 20;

/**
 * Brute-force protection on top of the global rate limit: 5 failed logins for an account
 * (or 20 from one IP) within 15 minutes lock that key for 15 minutes.
 * In-memory on purpose — the API runs as a single pm2 fork; move to Redis if it is ever clustered.
 */
@Injectable()
export class LoginGuardService {
  private readonly logger = new Logger(LoginGuardService.name);
  private readonly buckets = new Map<string, Bucket>();

  constructor() {
    setInterval(() => this.sweep(), 5 * 60_000).unref();
  }

  /** Throws 429 while a key is locked. Call before checking credentials. */
  assertAllowed(email: string, ip: string) {
    for (const key of [`u:${email}`, `ip:${ip}`]) {
      const b = this.buckets.get(key);
      if (b && b.lockedUntil > Date.now()) {
        const retryAfter = Math.ceil((b.lockedUntil - Date.now()) / 1000);
        throw new HttpException(
          { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: `Çok fazla başarısız deneme. ${Math.ceil(retryAfter / 60)} dakika sonra tekrar deneyin.`, retryAfter },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  recordFailure(email: string, ip: string) {
    this.bump(`u:${email}`, MAX_PER_ACCOUNT, `account ${email}`);
    this.bump(`ip:${ip}`, MAX_PER_IP, `ip ${ip}`);
  }

  recordSuccess(email: string) {
    this.buckets.delete(`u:${email}`);
  }

  private bump(key: string, max: number, label: string) {
    const now = Date.now();
    const b = this.buckets.get(key);
    const fresh = !b || now - b.firstAt > WINDOW_MS;
    const next: Bucket = fresh ? { failures: 1, firstAt: now, lockedUntil: 0 } : { ...b, failures: b.failures + 1 };
    if (next.failures >= max) {
      next.lockedUntil = now + LOCK_MS;
      next.failures = 0;
      next.firstAt = now;
      this.logger.warn(`login locked for ${label} (${max} failures in window)`);
    }
    this.buckets.set(key, next);
  }

  private sweep() {
    const now = Date.now();
    for (const [key, b] of this.buckets) {
      if (b.lockedUntil < now && now - b.firstAt > WINDOW_MS) this.buckets.delete(key);
    }
  }
}
