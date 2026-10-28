'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { CommandPalette } from '@/components/layout/command-palette';
import { homeForRole } from '@/components/layout/nav';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ErrorState } from '@/components/shared/query-state';
import { useMe } from '@/lib/queries/auth';
import type { AuthUser } from '@/lib/types';
import { cn } from '@/lib/utils';

// ── sidebar collapse preference (localStorage, hydration-safe via useSyncExternalStore) ──
const COLLAPSE_KEY = 'mj-admin-sidebar';
const listeners = new Set<() => void>();
function subscribeCollapsed(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}
function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function AdminShell({ initialUser, children }: { initialUser: AuthUser | null; children: React.ReactNode }) {
  const me = useMe(initialUser);
  const router = useRouter();
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const toggle = () => writeCollapsed(!collapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Editors have no dashboard access; land them on content.
  useEffect(() => {
    if (me.data?.role === 'EDITOR' && pathname === '/') router.replace(homeForRole('EDITOR'));
  }, [me.data?.role, pathname, router]);

  const role = me.data?.role;

  return (
    <div className="flex min-h-dvh bg-background">
      <div className={cn('sticky top-0 hidden h-dvh shrink-0 transition-[width] lg:block', collapsed ? 'w-14' : 'w-60')}>
        <Sidebar role={role} collapsed={collapsed} onToggle={toggle} />
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Menü</SheetTitle>
            <SheetDescription>Yönetim paneli menüsü</SheetDescription>
          </SheetHeader>
          <Sidebar role={role} collapsed={false} onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} className="border-0" />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={me.data} onOpenSearch={() => setSearchOpen(true)} onOpenMenu={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-5 sm:px-6">
          <div className="mx-auto w-full max-w-7xl">
            {me.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : me.isError ? (
              <ErrorState error={me.error} onRetry={() => me.refetch()} />
            ) : (
              children
            )}
          </div>
        </main>
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} role={role} />
    </div>
  );
}
