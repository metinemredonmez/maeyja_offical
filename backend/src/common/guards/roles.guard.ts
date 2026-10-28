import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Env } from '../../config/env.validation';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

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
    // Staff must have a second factor when the deployment requires it; the MFA endpoints themselves stay reachable.
    if (this.config.get('MFA_REQUIRED_FOR_STAFF', { infer: true }) && user.role !== UserRole.CUSTOMER && !user.mfa && !String(req.path).includes('/auth/mfa')) {
      throw new ForbiddenException({ statusCode: 403, message: 'İki adımlı doğrulama kurulumu gerekli', code: 'MFA_SETUP_REQUIRED' });
    }
    return true;
  }
}
