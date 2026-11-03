import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { SessionStateService } from '../../modules/session/session-state.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface AccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  mfa?: boolean;
  /** The account's sessionVersion when issued; tokens from before it was raised are dead (SES-02). */
  sv?: number;
  /** The sign-in this token belongs to (sessions list: "this device"). */
  fam?: string;
  typ: 'access';
}

/**
 * Global guard: every route needs a valid Bearer access token unless marked `@Public()`.
 * On public routes a valid token still populates `req.user`; an invalid one is ignored (guest).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly sessions: SessionStateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<AccessPayload>(token);
        if (payload.typ !== 'access') throw new Error('wrong token type');
        if (!(await this.sessions.isCurrent(payload.sub, payload.sv ?? 0))) throw new Error('session ended');
        req.user = { id: payload.sub, email: payload.email, role: payload.role, mfa: payload.mfa === true, family: payload.fam };
      } catch {
        if (!isPublic) throw new UnauthorizedException('Oturum süresi doldu, lütfen tekrar giriş yapın');
      }
    }

    if (!isPublic && !req.user) throw new UnauthorizedException('Giriş yapmanız gerekiyor');
    return true;
  }
}
