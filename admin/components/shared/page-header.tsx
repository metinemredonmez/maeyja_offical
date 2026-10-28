import Link from 'next/link';
import { ChevronLeftIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
};

export function PageHeader({ title, description, actions, backHref, backLabel, className }: Props) {
  return (
    <div className={cn('mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {backHref && (
          <Link href={backHref} className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-3.5" />
            {backLabel ?? 'Geri'}
          </Link>
        )}
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
