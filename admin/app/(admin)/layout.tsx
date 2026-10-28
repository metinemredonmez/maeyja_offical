import { AdminShell } from '@/components/layout/admin-shell';
import { serverGet } from '@/lib/api.server';
import type { AuthUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Server layout: tries to read the signed-in user once with the access cookie so the
 * shell renders with the right menu immediately. If the access token is expired the
 * client refetches through the BFF (which refreshes), so a failure here is not fatal.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let user: AuthUser | null = null;
  try {
    user = await serverGet<AuthUser>('/auth/me');
  } catch {
    user = null;
  }
  return <AdminShell initialUser={user}>{children}</AdminShell>;
}
