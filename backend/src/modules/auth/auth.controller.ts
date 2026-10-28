import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ClientIp } from '../../common/decorators/client-ip.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  MfaCodeDto,
  MfaDisableDto,
  MfaLoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';

const STRICT = { default: { limit: 8, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Throttle(STRICT)
  @Post('register')
  register(@Body() dto: RegisterDto, @ClientIp() ip: string, @Req() req: Request) {
    return this.auth.register(dto, { ip, userAgent: req.headers['user-agent'] });
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @ClientIp() ip: string, @Req() req: Request) {
    return this.auth.login(dto, { ip, userAgent: req.headers['user-agent'] });
  }

  /** Admin panel login: rejects customer accounts up front. */
  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('admin/login')
  adminLogin(@Body() dto: LoginDto, @ClientIp() ip: string, @Req() req: Request) {
    return this.auth.login(dto, { ip, userAgent: req.headers['user-agent'] }, true);
  }

  /** Second step after `admin/login` (or `login`) answered `{ mfaRequired: true, mfaToken }`. */
  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('login/mfa')
  loginMfa(@Body() dto: MfaLoginDto, @ClientIp() ip: string, @Req() req: Request) {
    return this.auth.loginMfa(dto.mfaToken, dto.code, { ip, userAgent: req.headers['user-agent'] });
  }

  @ApiBearerAuth()
  @Roles(...STAFF_ROLES)
  @Get('mfa')
  async mfaStatus(@CurrentUser() user: AuthUser) {
    return this.mfa.status(await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
  }

  @ApiBearerAuth()
  @Roles(...STAFF_ROLES)
  @Post('mfa/setup')
  mfaSetup(@CurrentUser() user: AuthUser) {
    return this.mfa.setup(user.id);
  }

  @ApiBearerAuth()
  @Roles(...STAFF_ROLES)
  @HttpCode(200)
  @Post('mfa/enable')
  mfaEnable(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto) {
    return this.mfa.enable(user.id, dto.code);
  }

  @ApiBearerAuth()
  @Roles(...STAFF_ROLES)
  @HttpCode(200)
  @Post('mfa/disable')
  mfaDisable(@CurrentUser() user: AuthUser, @Body() dto: MfaDisableDto) {
    return this.mfa.disable(user.id, dto.password, dto.code);
  }

  @ApiBearerAuth()
  @Roles(...STAFF_ROLES)
  @HttpCode(200)
  @Post('mfa/backup-codes')
  mfaBackupCodes(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto) {
    return this.mfa.regenerateBackupCodes(user.id, dto.code);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @ClientIp() ip: string, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, { ip, userAgent: req.headers['user-agent'] });
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('resend-verification')
  resendVerification(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.id);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }
}
