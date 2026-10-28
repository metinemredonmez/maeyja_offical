import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Shorthands used across admin controllers. */
export const STAFF_ROLES: UserRole[] = [UserRole.EDITOR, UserRole.ADMIN, UserRole.SUPER_ADMIN];
export const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
