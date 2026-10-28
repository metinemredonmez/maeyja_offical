import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { decrypt, encrypt, keyFromEnv } from '../../common/utils/crypto.util';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';

const ISSUER = 'MAEYJA Admin';
const BACKUP_CODES = 8;
const hashCode = (code: string) => createHash('sha256').update(code.replace(/\s|-/g, '').toUpperCase()).digest('hex');

/**
 * TOTP (RFC 6238) second factor for staff accounts. Secrets are AES-GCM encrypted at rest;
 * backup codes are stored hashed and burn on use. Customers never see this.
 */
@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly key: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.key = keyFromEnv(config.get('APP_ENCRYPTION_KEY', { infer: true }), config.get('JWT_ACCESS_SECRET', { infer: true }));
    authenticator.options = { window: 1 }; // accept ±30s clock drift
  }

  /** Step 1: generate a secret and QR for the authenticator app. Not active until `enable` succeeds. */
  async setup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!STAFF_ROLES.includes(user.role)) throw new ForbiddenException('İki adımlı doğrulama yalnızca yönetici hesapları için');
    if (user.mfaEnabledAt) throw new BadRequestException('İki adımlı doğrulama zaten açık');
    const secret = authenticator.generateSecret(20);
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: encrypt(secret, this.key) } });
    const otpauth = authenticator.keyuri(user.email, ISSUER, secret);
    return { secret, otpauth, qrDataUrl: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) };
  }

  /** Step 2: confirm with a live code; returns the one-time backup codes. */
  async enable(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret) throw new BadRequestException('Önce kurulumu başlatın');
    if (user.mfaEnabledAt) throw new BadRequestException('İki adımlı doğrulama zaten açık');
    if (!this.checkTotp(user, code)) throw new BadRequestException('Kod geçersiz');
    const codes = Array.from({ length: BACKUP_CODES }, () => randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'));
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { mfaEnabledAt: new Date(), mfaBackupCodes: codes.map(hashCode) } }),
      // Other sessions were opened without a second factor — close them.
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    this.logger.log(`mfa enabled for ${user.email}`);
    return { backupCodes: codes };
  }

  async disable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) throw new BadRequestException('Şifre hatalı');
    if (!(await this.verify(user, code))) throw new BadRequestException('Kod geçersiz');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: null, mfaEnabledAt: null, mfaBackupCodes: [] } });
    this.logger.warn(`mfa disabled for ${user.email}`);
    return { ok: true };
  }

  async regenerateBackupCodes(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaEnabledAt || !this.checkTotp(user, code)) throw new BadRequestException('Kod geçersiz');
    const codes = Array.from({ length: BACKUP_CODES }, () => randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'));
    await this.prisma.user.update({ where: { id: userId }, data: { mfaBackupCodes: codes.map(hashCode) } });
    return { backupCodes: codes };
  }

  /** Login step: TOTP code or an unused backup code (which is then burned). */
  async verify(user: User, code: string): Promise<boolean> {
    if (!user.mfaEnabledAt) return true;
    if (this.checkTotp(user, code)) return true;
    const h = hashCode(code);
    if (user.mfaBackupCodes.includes(h)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { mfaBackupCodes: user.mfaBackupCodes.filter((c) => c !== h) } });
      this.logger.warn(`backup code used by ${user.email} (${user.mfaBackupCodes.length - 1} left)`);
      return true;
    }
    return false;
  }

  status(user: User) {
    return { enabled: Boolean(user.mfaEnabledAt), backupCodesLeft: user.mfaBackupCodes.length };
  }

  private checkTotp(user: User, code: string) {
    if (!user.mfaSecret) return false;
    try {
      return authenticator.check(code.replace(/\s/g, ''), decrypt(user.mfaSecret, this.key));
    } catch (e) {
      this.logger.error(`cannot decrypt mfa secret for ${user.email}: ${(e as Error).message}`);
      throw new UnauthorizedException('İki adımlı doğrulama hatası');
    }
  }
}
