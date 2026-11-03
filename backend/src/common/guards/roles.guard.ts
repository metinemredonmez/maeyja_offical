import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Env } from '../../config/env.validation';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/** GET auth/mfa, POST auth/mfa/setup and auth/mfa/enable (with the global prefix in front). */
const MFA_SETUP_ROUTE = /^\/[^/]+\/auth\/mfa(\/(setup|enable))?$/;

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly mfaRequired: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
  ) {
    const isProd = config.get('NODE_ENV', { infer: true }) === 'production';
    const flag = config.get('MFA_REQUIRED_FOR_STAFF', { infer: true });
    this.mfaRequired = flag ?? isProd;
    // An accepted risk when chosen, never the default: said once at every start.
    if (isProd && flag === false) new Logger(RolesGuard.name).warn('staff MFA is switched off (MFA_REQUIRED_FOR_STAFF=false)');
  }

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Bu işlem için yetkiniz yok');
    // AUT-01: staff need a second factor (production default; MFA_REQUIRED_FOR_STAFF decides when set).
    // Only the routes that set it up stay reachable without it (matched on the route, not the raw URL).
    if (this.mfaRequired && user.role !== UserRole.CUSTOMER && !user.mfa && !MFA_SETUP_ROUTE.test(String(req.route?.path ?? ''))) {
      throw new ForbiddenException({ statusCode: 403, message: 'İki adımlı doğrulama kurulumu gerekli', code: 'MFA_SETUP_REQUIRED' });
    }
    return true;
  }
}
