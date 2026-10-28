import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface AccessPayload {
  sub: string;
  email: string;
  role: UserRole;
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
        req.user = { id: payload.sub, email: payload.email, role: payload.role };
      } catch {
        if (!isPublic) throw new UnauthorizedException('Oturum süresi doldu, lütfen tekrar giriş yapın');
      }
    }

    if (!isPublic && !req.user) throw new UnauthorizedException('Giriş yapmanız gerekiyor');
    return true;
  }
}
