import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AiToolsController } from './ai-tools.controller';

/** Roles the guard applies to a route: the handler's own, else the controller's (same order as RolesGuard). */
const rolesOf = (name: keyof AiToolsController) =>
  (Reflect.getMetadata(ROLES_KEY, AiToolsController.prototype[name]) ?? Reflect.getMetadata(ROLES_KEY, AiToolsController)) as UserRole[];

describe('AI tools roles (AZ-01, AZ-03)', () => {
  it('keeps inbox drafts and the revenue summary away from editors', () => {
    for (const route of ['reply', 'weekly'] as const) {
      expect(rolesOf(route)).not.toContain(UserRole.EDITOR);
      expect(rolesOf(route)).toContain(UserRole.ADMIN);
    }
  });

  it('still lets editors write product texts', () => {
    expect(rolesOf('alt')).toContain(UserRole.EDITOR);
    expect(rolesOf('caption')).toContain(UserRole.EDITOR);
  });
});
