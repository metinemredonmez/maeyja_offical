import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthTokenType, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { decrypt, encrypt, keyFromEnv } from '../../common/utils/crypto.util';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { templates } from '../notifications/mail.templates';
import { SessionStateService } from '../session/session-state.service';

const ISSUER = 'MAEYJA Admin';
const BACKUP_CODES = 8;
const STEP_SECONDS = 30;
/** AUT-02: wrong codes in a row before the second step locks; every further run doubles the lock, up to a day. */
const LOCK_AFTER = 5;
const LOCK_BASE_MS = 15 * 60_000;
const LOCK_MAX_MS = 24 * 3600_000;
const ENROLL_TTL_MS = 10 * 60_000;
const hashCode = (code: string) => createHash('sha256').update(code.replace(/\s|-/g, '').toUpperCase()).digest('hex');
/** Per user, so two people can hold the same 6 digits at once (tokenHash is unique). */
const hashEnrollCode = (userId: string, code: string) => createHash('sha256').update(`mfa-enroll:${userId}:${code.replace(/\s/g, '')}`).digest('hex');
const newBackupCodes = () => Array.from({ length: BACKUP_CODES }, () => randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'));

/**
 * TOTP (RFC 6238) second factor for staff accounts. Secrets are AES-GCM encrypted at rest; backup codes are
 * stored hashed and burn on use. Every code works once (AUT-01), wrong codes lock the second step whatever the
 * password step did (AUT-02), and adding or removing the factor is confirmed and announced by e-mail (AUT-04).
 */
@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly key: Buffer;
  private readonly adminEmail: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sessions: SessionStateService,
    config: ConfigService<Env, true>,
  ) {
    this.key = keyFromEnv(config.get('APP_ENCRYPTION_KEY', { infer: true }), config.get('JWT_ACCESS_SECRET', { infer: true }));
    this.adminEmail = config.get('ADMIN_NOTIFY_EMAIL', { infer: true });
    authenticator.options = { window: 1, step: STEP_SECONDS }; // accept ±30s clock drift
  }

  /**
   * Step 1: generate a secret and QR for the authenticator app. Not active until `enable` succeeds.
   * A 6-digit code also goes to the account's e-mail: a stolen password alone can't bind the thief's phone.
   */
  async setup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!STAFF_ROLES.includes(user.role)) throw new ForbiddenException('İki adımlı doğrulama yalnızca yönetici hesapları için');
    if (user.mfaEnabledAt) throw new BadRequestException('İki adımlı doğrulama zaten açık');
    this.assertNotLocked(user);
    const secret = authenticator.generateSecret(20);
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: encrypt(secret, this.key), mfaLastStep: null } });
    const otpauth = authenticator.keyuri(user.email, ISSUER, secret);
    return { secret, otpauth, qrDataUrl: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }), emailCodeSent: await this.sendEnrollCode(user) };
  }

  /** Step 2: confirm with a live code (and the e-mailed one); returns the one-time backup codes. */
  async enable(userId: string, code: string, emailCode?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret) throw new BadRequestException('Önce kurulumu başlatın');
    if (user.mfaEnabledAt) throw new BadRequestException('İki adımlı doğrulama zaten açık');
    this.assertNotLocked(user);

    const enroll = await this.prisma.authToken.findFirst({
      where: { userId, type: AuthTokenType.MFA_ENROLL, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (enroll && !(emailCode && this.sameHash(enroll.tokenHash, hashEnrollCode(userId, emailCode)))) {
      await this.recordFailure(user, 'kurulum (e-posta kodu)');
      throw new BadRequestException('E-postadaki onay kodu geçersiz');
    }
    if (!(await this.consumeTotp(user, code))) {
      await this.recordFailure(user, 'kurulum');
      throw new BadRequestException('Kod geçersiz');
    }

    const codes = newBackupCodes();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { mfaEnabledAt: new Date(), mfaBackupCodes: codes.map(hashCode), mfaFailures: 0, mfaLockedUntil: null } }),
      this.prisma.authToken.updateMany({ where: { userId, type: AuthTokenType.MFA_ENROLL, usedAt: null }, data: { usedAt: new Date() } }),
    ]);
    // Every session was opened without a second factor — they all end now (access tokens too).
    await this.sessions.endAll(userId);
    this.logger.log(`mfa enabled for ${user.email}`);
    this.notify(user, 'İki adımlı doğrulama açıldı', ['Hesabınıza bir doğrulama uygulaması bağlandı. Diğer bütün oturumlar kapatıldı.']);
    return { backupCodes: codes };
  }

  /** Removing the factor needs the password and a code; every session closes and the owner is told. */
  async disable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.assertNotLocked(user);
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) throw new BadRequestException('Şifre hatalı');
    if (!(await this.check(user, code))) {
      await this.recordFailure(user, 'kapatma');
      throw new BadRequestException('Kod geçersiz');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: null, mfaEnabledAt: null, mfaBackupCodes: [], mfaFailures: 0, mfaLockedUntil: null, mfaLastStep: null } });
    await this.sessions.endAll(userId);
    this.logger.warn(`mfa disabled for ${user.email}`);
    this.notify(user, 'İki adımlı doğrulama kapatıldı', ['Hesabınızdaki doğrulama uygulaması kaldırıldı ve bütün oturumlar kapatıldı.']);
    return { ok: true };
  }

  async regenerateBackupCodes(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaEnabledAt) throw new BadRequestException('Kod geçersiz');
    this.assertNotLocked(user);
    if (!(await this.consumeTotp(user, code))) {
      await this.recordFailure(user, 'yedek kod yenileme');
      throw new BadRequestException('Kod geçersiz');
    }
    const codes = newBackupCodes();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaBackupCodes: codes.map(hashCode), mfaFailures: 0 } });
    this.notify(user, 'Yedek kodlar yenilendi', ['Eski yedek kodlarınız artık geçersiz.']);
    return { backupCodes: codes };
  }

  /**
   * Login step: TOTP code or an unused backup code (which is then burned). Counts failures on the account,
   * not the password step, so logging in again with the right password doesn't buy more guesses.
   */
  async verify(user: User, code: string): Promise<boolean> {
    if (!user.mfaEnabledAt) return true;
    this.assertNotLocked(user);
    if (await this.check(user, code)) {
      if (user.mfaFailures || user.mfaLockedUntil) await this.prisma.user.update({ where: { id: user.id }, data: { mfaFailures: 0, mfaLockedUntil: null } });
      return true;
    }
    await this.recordFailure(user, 'giriş');
    return false;
  }

  status(user: User) {
    return { enabled: Boolean(user.mfaEnabledAt), backupCodesLeft: user.mfaBackupCodes.length };
  }

  /** Throws 429 while the second step is locked for this account. */
  assertNotLocked(user: Pick<User, 'mfaLockedUntil'>) {
    if (user.mfaLockedUntil && user.mfaLockedUntil > new Date()) {
      const minutes = Math.ceil((user.mfaLockedUntil.getTime() - Date.now()) / 60_000);
      throw new HttpException({ statusCode: HttpStatus.TOO_MANY_REQUESTS, message: `Çok fazla yanlış kod. ${minutes} dakika sonra tekrar deneyin.` }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /** TOTP or backup code; both single use. */
  private async check(user: User, code: string) {
    return (await this.consumeTotp(user, code)) || (await this.consumeBackupCode(user, code));
  }

  /** AUT-01: a code is accepted once — its time step must be newer than the last one used (claimed atomically). */
  private async consumeTotp(user: User, code: string) {
    if (!user.mfaSecret) return false;
    let delta: number | null;
    try {
      delta = authenticator.checkDelta(code.replace(/\s/g, ''), decrypt(user.mfaSecret, this.key));
    } catch (e) {
      this.logger.error(`cannot decrypt mfa secret for ${user.email}: ${(e as Error).message}`);
      throw new UnauthorizedException('İki adımlı doğrulama hatası');
    }
    if (delta === null) return false;
    const step = Math.floor(Date.now() / 1000 / STEP_SECONDS) + delta;
    const claimed = await this.prisma.user.updateMany({ where: { id: user.id, OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: step } }] }, data: { mfaLastStep: step } });
    if (claimed.count === 0) this.logger.warn(`replayed totp code for ${user.email}`);
    return claimed.count === 1;
  }

  /** Burns the code in the same statement that checks it, so two parallel logins can't share one. */
  private async consumeBackupCode(user: User, code: string) {
    const h = hashCode(code);
    if (!user.mfaBackupCodes.includes(h)) return false;
    const burned = await this.prisma.$executeRaw`UPDATE "User" SET "mfaBackupCodes" = array_remove("mfaBackupCodes", ${h}) WHERE "id" = ${user.id} AND ${h} = ANY("mfaBackupCodes")`;
    if (burned !== 1) return false;
    const left = user.mfaBackupCodes.length - 1;
    this.logger.warn(`backup code used by ${user.email} (${left} left)`);
    this.notify(user, 'Yedek kod kullanıldı', [`Hesabınıza bir yedek kodla giriş yapıldı. Kalan yedek kod: ${left}.`]);
    return true;
  }

  private async recordFailure(user: User, where: string) {
    const { mfaFailures } = await this.prisma.user.update({ where: { id: user.id }, data: { mfaFailures: { increment: 1 } }, select: { mfaFailures: true } });
    this.logger.warn(`wrong mfa code for ${user.email} (${where}, ${mfaFailures} in a row)`);
    if (mfaFailures % LOCK_AFTER !== 0) return;
    const ms = Math.min(LOCK_BASE_MS * 2 ** (mfaFailures / LOCK_AFTER - 1), LOCK_MAX_MS);
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaLockedUntil: new Date(Date.now() + ms) } });
    this.logger.warn(`mfa locked for ${user.email} for ${ms / 60_000} min`);
    this.notify(user, 'İki adımlı doğrulama kilitlendi', [
      `Hesabınızda ${LOCK_AFTER} kez üst üste yanlış doğrulama kodu girildi (${where}). İkinci adım ${ms / 60_000} dakika kilitlendi.`,
      'Kodu siz girmediyseniz şifreniz başkasının elinde: hemen değiştirin.',
    ]);
  }

  /** Only when mail actually goes out; otherwise enrollment falls back to the authenticator code alone. */
  private async sendEnrollCode(user: User) {
    if (!this.mail.enabled) {
      this.logger.warn(`SMTP not configured: mfa enrollment for ${user.email} is not e-mail confirmed`);
      return false;
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!(await this.mail.send(user.email, templates.mfaEnrollCode(code)))) return false;
    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({ where: { userId: user.id, type: AuthTokenType.MFA_ENROLL, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.authToken.create({ data: { userId: user.id, type: AuthTokenType.MFA_ENROLL, tokenHash: hashEnrollCode(user.id, code), expiresAt: new Date(Date.now() + ENROLL_TTL_MS) } }),
    ]);
    return true;
  }

  private sameHash(a: string, b: string) {
    const x = Buffer.from(a), y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
  }

  /** To the account owner and the shop's admin address; never blocks the request. */
  notify(user: Pick<User, 'email'>, title: string, lines: string[]) {
    const content = templates.securityNotice(title, [...lines, `Hesap: ${user.email}`]);
    void this.mail.send(user.email, content);
    if (this.adminEmail && this.adminEmail.toLowerCase() !== user.email.toLowerCase()) void this.mail.send(this.adminEmail, content);
  }
}
