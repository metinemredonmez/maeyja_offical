import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenType, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { generateToken, hashToken } from '../../common/utils/token.util';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { mailLocale, templates } from '../notifications/mail.templates';
import { ChangePasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 12;
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
  ) {}

  async register(dto: RegisterDto, meta: ClientMeta) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('Bu e-posta ile kayıtlı bir hesap var');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        phone: dto.phone,
        marketingOptIn: dto.marketingOptIn ?? false,
        locale: dto.locale ?? 'tr',
      },
    });

    if (user.marketingOptIn) {
      await this.prisma.newsletterSubscriber.upsert({
        where: { email: user.email },
        create: { email: user.email, locale: user.locale, source: 'register' },
        update: { unsubscribedAt: null },
      });
    }

    const locale = mailLocale(user.locale);
    void this.mail.send(user.email, templates.welcome(locale, user.firstName, this.webUrl('/shop')));
    void this.sendVerification(user);
    return this.issueSession(user, meta);
  }

  async login(dto: LoginDto, meta: ClientMeta, staffOnly = false) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Compare against a dummy hash when the user doesn't exist so timing doesn't leak accounts.
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || user.deletedAt) throw new UnauthorizedException('E-posta veya şifre hatalı');
    if (!user.isActive) throw new ForbiddenException('Hesabınız askıya alınmış');
    if (staffOnly && !STAFF_ROLES.includes(user.role)) throw new ForbiddenException('Yönetim paneline erişim yetkiniz yok');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
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
    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
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
      const base = isStaff ? this.config.get('ADMIN_URL', { infer: true }) : this.config.get('WEB_URL', { infer: true });
      void this.mail.send(user.email, templates.passwordReset(mailLocale(user.locale), `${base}/reset-password?token=${token}`));
    }
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.consumeAuthToken(dto.token, AuthTokenType.PASSWORD_RESET);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS) } }),
      this.prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { ok: true };
  }

  async verifyEmail(token: string) {
    const record = await this.consumeAuthToken(token, AuthTokenType.EMAIL_VERIFY);
    await this.prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
    return { ok: true };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return { ok: true, alreadyVerified: true };
    await this.sendVerification(user);
    return { ok: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Mevcut şifre hatalı');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) } });
    return { ok: true };
  }

  // ─────────────────────────── helpers ───────────────────────────

  private async issueSession(user: User, meta: ClientMeta) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role, typ: 'access' });
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
    await this.mail.send(user.email, templates.verifyEmail(mailLocale(user.locale), this.webUrl(`/verify-email?token=${token}`)));
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
    await this.prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return record;
  }

  private webUrl(path: string) {
    return `${this.config.get('WEB_URL', { infer: true })}${path}`;
  }
}
