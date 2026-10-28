'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { navForRole } from '@/components/layout/nav';
import type { UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = { role: UserRole | undefined; collapsed: boolean; onToggle: () => void; onNavigate?: () => void; className?: string };

export function Sidebar({ role, collapsed, onToggle, onNavigate, className }: Props) {
  const pathname = usePathname();
  const groups = navForRole(role);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));

  return (
    <aside className={cn('flex h-full flex-col border-r bg-sidebar text-sidebar-foreground', className)} aria-label="Ana menü">
      <div className={cn('flex h-14 items-center border-b px-3', collapsed ? 'justify-center' : 'justify-between')}>
        <Link href="/" className="flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onNavigate}>
          <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-[11px] font-semibold tracking-[0.2em] text-background">M</span>
          {!collapsed && <span className="text-sm font-semibold tracking-[0.42em]">MAEYJA</span>}
        </Link>
        {!collapsed && (
          <button type="button" onClick={onToggle} className="hidden rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground lg:block" aria-label="Menüyü daralt">
            <PanelLeftCloseIcon className="size-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((g) => (
          <div key={g.label} className="mb-4">
            {!collapsed && <p className="mb-1 px-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{g.label}</p>}
            {collapsed && <div className="mx-2 mb-2 h-px bg-border" />}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(item.href);
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'bg-foreground text-background' : 'text-foreground/80 hover:bg-sidebar-accent hover:text-foreground',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger render={<span className="block" />}>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {collapsed && (
        <div className="border-t p-2">
          <button type="button" onClick={onToggle} className="flex w-full items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" aria-label="Menüyü genişlet">
            <PanelLeftOpenIcon className="size-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
