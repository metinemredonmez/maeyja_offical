'use client';

import Link from 'next/link';
import { TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlertSummary } from '@/lib/queries/alerts';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/types';

/** Top bar: how many alerts are open (red when one is urgent). Hidden when there are none, and for editors. */
export function AlertsBell({ role }: { role: UserRole | undefined }) {
  const summary = useAlertSummary(role === 'ADMIN' || role === 'SUPER_ADMIN');
  const open = summary.data?.open ?? 0;
  if (!open) return null;
  const urgent = (summary.data?.critical ?? 0) > 0;
  return (
    <Button variant="ghost" size="sm" className="gap-1.5" render={<Link href="/alerts" />} aria-label={`${open} açık uyarı`}>
      <TriangleAlertIcon className={cn(urgent ? 'text-destructive' : 'text-amber-600')} />
      <span className={cn('rounded-full px-1.5 text-[11px] font-semibold tabular-nums text-white', urgent ? 'bg-destructive' : 'bg-amber-600')}>{open}</span>
    </Button>
  );
}
