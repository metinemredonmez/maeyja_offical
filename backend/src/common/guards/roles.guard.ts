import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Env } from '../../config/env.validation';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** GET auth/mfa, POST auth/mfa/setup and auth/mfa/enable (with the global prefix in front). */
const MFA_SETUP_ROUTE = /^\/[^/]+\/auth\/mfa(\/(setup|enable))?$/;

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Bu işlem için yetkiniz yok');
    // AUT-01: staff need a second factor — always in production, elsewhere when MFA_REQUIRED_FOR_STAFF is set.
    // Only the routes that set it up stay reachable without it (matched on the route, not the raw URL).
    const required = this.config.get('NODE_ENV', { infer: true }) === 'production' || this.config.get('MFA_REQUIRED_FOR_STAFF', { infer: true });
    if (required && user.role !== UserRole.CUSTOMER && !user.mfa && !MFA_SETUP_ROUTE.test(String(req.route?.path ?? ''))) {
      throw new ForbiddenException({ statusCode: 403, message: 'İki adımlı doğrulama kurulumu gerekli', code: 'MFA_SETUP_REQUIRED' });
    }
    return true;
  }
}
