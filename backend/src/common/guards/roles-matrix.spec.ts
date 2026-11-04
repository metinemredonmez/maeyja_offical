import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { readdirSync } from 'fs';
import { join } from 'path';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

type Route = { route: string; roles: UserRole[] | undefined; isPublic: boolean };

/** Every route of every controller, with the roles RolesGuard applies (the handler's own, else the controller's). */
function routes(): Route[] {
  const dir = join(__dirname, '../../modules');
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.controller.ts'));
  const out: Route[] = [];
  for (const file of files) {
    for (const Ctrl of Object.values(require(join(dir, file)) as Record<string, unknown>)) {
      if (typeof Ctrl !== 'function' || Reflect.getMetadata(PATH_METADATA, Ctrl) === undefined) continue;
      const base = ([] as string[]).concat(Reflect.getMetadata(PATH_METADATA, Ctrl))[0].replace(/^\/|\/$/g, '');
      for (const name of Object.getOwnPropertyNames(Ctrl.prototype)) {
        const handler = (Ctrl.prototype as Record<string, unknown>)[name];
        if (name === 'constructor' || typeof handler !== 'function' || Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
        const sub = ([] as string[]).concat(Reflect.getMetadata(PATH_METADATA, handler) ?? '')[0].replace(/^\/|\/$/g, '');
        out.push({
          route: `${RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)]} ${[base, sub].filter(Boolean).join('/')}`,
          roles: Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, Ctrl),
          isPublic: Boolean(Reflect.getMetadata(IS_PUBLIC_KEY, handler) ?? Reflect.getMetadata(IS_PUBLIC_KEY, Ctrl)),
        });
      }
    }
  }
  return out;
}

/** CLAUDE.md / AZ-01: personal data, revenue, money and settings are for admins, not editors. */
const ADMIN_ONLY = /^(GET|POST|PUT|PATCH|DELETE) admin\/(orders|customers|users|returns|newsletter|contact|messages|mail|audit-logs|alerts|settings|payments|campaigns|dashboard|stats|coupons|push|ai\/(reply|weekly))/;

describe('role matrix for every admin route (API-01, OPS-04)', () => {
  const all = routes();
  const admin = all.filter((r) => / admin(\/|$)/.test(r.route));
  if (process.env.PRINT_ROLES) console.log(admin.map((r) => `${r.route} → ${r.isPublic ? 'PUBLIC' : (r.roles ?? []).join(',')}`).join('\n'));

  it('finds the admin controllers', () => {
    expect(admin.length).toBeGreaterThan(50);
  });

  it('gives every admin route explicit staff roles and never makes one public', () => {
    const bad = admin.filter((r) => r.isPublic || !r.roles?.length || r.roles.includes(UserRole.CUSTOMER)).map((r) => r.route);
    expect(bad).toEqual([]);
  });

  it('keeps personal data, revenue and settings away from editors', () => {
    const bad = admin.filter((r) => ADMIN_ONLY.test(r.route) && r.roles?.includes(UserRole.EDITOR)).map((r) => r.route);
    expect(bad).toEqual([]);
  });

  it('lets only a super admin create staff accounts', () => {
    expect(admin.find((r) => r.route === 'POST admin/users')?.roles).toEqual([UserRole.SUPER_ADMIN]);
  });
});
