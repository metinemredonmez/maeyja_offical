import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenType, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { storefrontPath } from '../../common/utils/i18n.util';
import { generateToken, hashToken } from '../../common/utils/token.util';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { mailLocale, templates } from '../notifications/mail.templates';
import { UsageService } from '../usage/usage.service';
import { ChangePasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';
import { LoginGuardService } from './login-guard.service';
import { MfaService } from './mfa.service';

const BCRYPT_ROUNDS = 12;
/** What sign-up always answers (AUT-02): the next step is in the e-mail either way. */
const CHECK_EMAIL = { ok: true as const, checkEmail: true as const };
const REGISTER_MAILS_PER_HOUR = 3;
const VERIFY_TTL_MS = 48 * 3600_000;
const RESET_TTL_MS = 3600_000;
// Real hash so bcrypt.compare costs the same whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync('maeyja-timing-guard', BCRYPT_ROUNDS);

interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

export const publicUser = (u: User) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  phone: u.phone,
  role: u.role,
  locale: u.locale,
  marketingOptIn: u.marketingOptIn,
  emailVerified: Boolean(u.emailVerifiedAt),
  mfaEnabled: Boolean(u.mfaEnabledAt),
  createdAt: u.createdAt,
});

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly mail: MailService,
    private readonly loginGuard: LoginGuardService,
    private readonly mfa: MfaService,
    private readonly usage: UsageService,
  ) {}

  /**
   * AUT-02: the answer (and its timing) is the same whether or not the address already has an account, so the form
   * can't be used to find out who shops here. Nothing is created yet: the account, with this password, opens when
   * the link in the e-mail is clicked (`verifyEmail`), so only the mailbox owner can open one for an address. The
   * owner of an existing account gets an e-mail saying so instead. At most a few e-mails per address an hour.
   */
  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const locale = dto.locale ?? 'tr';
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!(await this.usage.take(`mail:register:${dto.email}`, REGISTER_MAILS_PER_HOUR, 3600_000))) return CHECK_EMAIL;

    if (existing) {
      if (existing.isActive && !existing.deletedAt) {
        // A reset link, not a sign-in link: whoever set that account's password, its owner picks a new one.
        const l = existing.locale ?? locale;
        void this.mail.send(existing.email, templates.accountExists(mailLocale(l), this.webUrl(l, '/account/login'), this.webUrl(l, '/account/forgot-password')));
      }
      return CHECK_EMAIL;
    }

    const token = generateToken();
    const data = { firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), phone: dto.phone ?? null, passwordHash, marketingOptIn: dto.marketingOptIn ?? false, locale };
    await this.prisma.pendingRegistration.create({ data: { email: dto.email, tokenHash: hashToken(token), data, expiresAt: new Date(Date.now() + VERIFY_TTL_MS) } });
    void this.mail.send(dto.email, templates.confirmRegistration(mailLocale(locale), this.webUrl(locale, `/verify-email?token=${token}`)));
    return CHECK_EMAIL;
  }

  async login(dto: LoginDto, meta: ClientMeta, staffOnly = false) {
    const ip = meta.ip ?? 'unknown';
    await this.loginGuard.assertAllowed(dto.email, ip);
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Compare against a dummy hash when the user doesn't exist so timing doesn't leak accounts.
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || user.deletedAt) {
      await this.loginGuard.recordFailure(dto.email, ip);
      this.logger.warn(`failed login for ${dto.email} from ${ip}${staffOnly ? ' (admin)' : ''}`);
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }
    if (!user.isActive) throw new ForbiddenException('Hesabınız askıya alınmış');
    if (staffOnly && !STAFF_ROLES.includes(user.role)) {
      await this.loginGuard.recordFailure(dto.email, ip);
      throw new ForbiddenException('Yönetim paneline erişim yetkiniz yok');
    }

    await this.loginGuard.recordSuccess(dto.email, ip);

    // Staff with TOTP enabled: password alone only buys a 5-minute token for the second step.
    if (user.mfaEnabledAt) {
      this.mfa.assertNotLocked(user);
      const mfaToken = await this.jwt.signAsync({ sub: user.id, typ: 'mfa' }, { expiresIn: '5m' });
      return { mfaRequired: true as const, mfaToken };
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    if (staffOnly) this.logger.log(`admin login: ${user.email} from ${ip}`);
    return this.issueSession(user, meta);
  }

  /** Second login step for MFA-enabled accounts. */
  async loginMfa(mfaToken: string, code: string, meta: ClientMeta) {
    const ip = meta.ip ?? 'unknown';
    let payload: { sub: string; typ: string };
    try {
      payload = await this.jwt.verifyAsync(mfaToken);
    } catch {
      throw new UnauthorizedException('Oturum süresi doldu, tekrar giriş yapın');
    }
    if (payload.typ !== 'mfa') throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.deletedAt) throw new UnauthorizedException();
    // AUT-02: the account's second-step counter lives in MfaService; only the address is limited here.
    await this.loginGuard.assertIpAllowed(ip);
    if (!(await this.mfa.verify(user, code))) {
      await this.loginGuard.recordIpFailure(ip);
      this.logger.warn(`failed mfa for ${user.email} from ${ip}`);
      throw new UnauthorizedException('Doğrulama kodu geçersiz');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    this.logger.log(`admin login (mfa): ${user.email} from ${ip}`);
    return this.issueSession(user, meta);
  }

  /** Rotating refresh tokens; presenting an already-revoked token revokes the whole family (theft signal). */
  async refresh(refreshToken: string, meta: ClientMeta) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!record) throw new UnauthorizedException('Oturum geçersiz');
    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      this.logger.warn(`refresh token reuse detected for user ${record.userId}`);
      throw new UnauthorizedException('Oturum geçersiz');
    }
    if (record.expiresAt < new Date() || !record.user.isActive || record.user.deletedAt) {
      throw new UnauthorizedException('Oturum süresi doldu');
    }
    // Atomic: two parallel refreshes with the same token can't both succeed.
    const claimed = await this.prisma.refreshToken.updateMany({ where: { id: record.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (claimed.count === 0) throw new UnauthorizedException('Oturum geçersiz');
    return this.issueSession(record.user, meta);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new UnauthorizedException();
    return publicUser(user);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Same response either way — don't reveal which emails have accounts.
    if (user && user.isActive && !user.deletedAt) {
      const token = await this.createAuthToken(user.id, AuthTokenType.PASSWORD_RESET, RESET_TTL_MS);
      const isStaff = user.role !== UserRole.CUSTOMER;
      // Staff reset in the admin; customers on the storefront's account page, in their own language.
      const link = isStaff ? `${this.config.get('ADMIN_URL', { infer: true })}/reset-password?token=${token}` : this.webUrl(user.locale, `/account/reset-password?token=${token}`);
      void this.mail.send(user.email, templates.passwordReset(mailLocale(user.locale), link));
    }
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.consumeAuthToken(dto.token, AuthTokenType.PASSWORD_RESET);
    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS) } }),
      this.prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      // The link came to the mailbox, so the address is proven too.
      this.prisma.user.updateMany({ where: { id: record.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } }),
    ]);
    if (user.role !== UserRole.CUSTOMER) this.mfa.notify(user, 'Şifre sıfırlandı', ['Hesabınızın şifresi e-postadaki bağlantıyla yenilendi ve bütün oturumlar kapatıldı.']);
    return { ok: true };
  }

  /**
   * The e-mail link. From sign-up it opens the account (verified, with the password chosen then) and signs in;
   * from "verify again" on an existing account it only marks the address as verified.
   */
  async verifyEmail(token: string, meta: ClientMeta) {
    const pending = await this.prisma.pendingRegistration.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!pending) {
      const record = await this.consumeAuthToken(token, AuthTokenType.EMAIL_VERIFY);
      await this.prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
      return { ok: true };
    }
    // Single use: claimed by deleting it; a second click (or a parallel one) finds nothing.
    const claimed = await this.prisma.pendingRegistration.deleteMany({ where: { id: pending.id, expiresAt: { gt: new Date() } } });
    if (claimed.count === 0) throw new BadRequestException('Bağlantı geçersiz veya süresi dolmuş');
    if (await this.prisma.user.findUnique({ where: { email: pending.email } })) {
      throw new BadRequestException('Bu e-postayla bir hesap zaten açılmış; giriş yapın');
    }
    const d = pending.data as { firstName: string; lastName: string; phone: string | null; passwordHash: string; marketingOptIn: boolean; locale: string };
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: pending.email, passwordHash: d.passwordHash, firstName: d.firstName, lastName: d.lastName, phone: d.phone, marketingOptIn: d.marketingOptIn, locale: d.locale, emailVerifiedAt: new Date() },
      });
      // Other sign-up links for this address are now pointless.
      await tx.pendingRegistration.deleteMany({ where: { email: pending.email } });
      // Consent counts from here: the address has confirmed itself (double opt-in, ETK/İYS).
      if (created.marketingOptIn) {
        await tx.newsletterSubscriber.upsert({
          where: { email: created.email },
          create: { email: created.email, locale: created.locale, source: 'register' },
          update: { unsubscribedAt: null },
        });
      }
      return created;
    });
    void this.mail.send(user.email, templates.welcome(mailLocale(user.locale), user.firstName, this.webUrl(user.locale, '/products')));
    return { ok: true, signedIn: true, ...(await this.issueSession(user, meta)) };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return { ok: true, alreadyVerified: true };
    await this.sendVerification(user);
    return { ok: true };
  }

  /** Changing the password closes every other session and hands back a fresh one for this device. */
  async changePassword(userId: string, dto: ChangePasswordDto, meta: ClientMeta) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Mevcut şifre hatalı');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    this.logger.log(`password changed for ${user.email}`);
    if (user.role !== UserRole.CUSTOMER) this.mfa.notify(user, 'Şifre değiştirildi', ['Hesabınızın şifresi değiştirildi; diğer oturumlar kapatıldı.']);
    return { ok: true, ...(await this.issueSession(updated, meta)) };
  }

  // ─────────────────────────── helpers ───────────────────────────

  private async issueSession(user: User, meta: ClientMeta) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role, mfa: Boolean(user.mfaEnabledAt), typ: 'access' });
    const refreshToken = generateToken(48);
    const days = this.config.get('JWT_REFRESH_TTL_DAYS', { infer: true });
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + days * 86400_000),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255),
      },
    });
    return { accessToken, refreshToken, user: publicUser(user) };
  }

  private async sendVerification(user: User) {
    const token = await this.createAuthToken(user.id, AuthTokenType.EMAIL_VERIFY, VERIFY_TTL_MS);
    await this.mail.send(user.email, templates.verifyEmail(mailLocale(user.locale), this.webUrl(user.locale, `/verify-email?token=${token}`)));
  }

  private async createAuthToken(userId: string, type: AuthTokenType, ttlMs: number) {
    const token = generateToken();
    // Only the latest link of a given type stays valid.
    await this.prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.authToken.create({
      data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
    });
    return token;
  }

  private async consumeAuthToken(token: string, type: AuthTokenType) {
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Bağlantı geçersiz veya süresi dolmuş');
    }
    const claimed = await this.prisma.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count === 0) throw new BadRequestException('Bağlantı geçersiz veya süresi dolmuş');
    return record;
  }

  private webUrl(locale: string | null | undefined, path: string) {
    return `${this.config.get('WEB_URL', { infer: true })}${storefrontPath(locale, path)}`;
  }
}
