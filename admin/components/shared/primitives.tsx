'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDate, formatDateTime, formatMoney, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

export function Money({ value, className, muted }: { value: number | string | null | undefined; className?: string; muted?: boolean }) {
  return <span className={cn('tabular-nums', muted && 'text-muted-foreground', className)}>{formatMoney(value)}</span>;
}

export function DateTime({ value, mode = 'datetime', className }: { value: string | Date | null | undefined; mode?: 'datetime' | 'date' | 'relative'; className?: string }) {
  if (!value) return <span className={cn('text-muted-foreground', className)}>—</span>;
  const text = mode === 'date' ? formatDate(value) : mode === 'relative' ? formatRelative(value) : formatDateTime(value);
  if (mode !== 'relative') return <time className={cn('whitespace-nowrap tabular-nums', className)}>{text}</time>;
  return (
    <Tooltip>
      <TooltipTrigger render={<time className={cn('whitespace-nowrap', className)} />}>{text}</TooltipTrigger>
      <TooltipContent>{formatDateTime(value)}</TooltipContent>
    </Tooltip>
  );
}

export function ColorSwatch({ hex, hex2, size = 'md', className }: { hex: string; hex2?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dim = size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-7' : 'size-5';
  const style = hex2 ? { background: `linear-gradient(135deg, ${hex} 50%, ${hex2} 50%)` } : { backgroundColor: hex };
  return <span aria-hidden className={cn('inline-block shrink-0 rounded-full ring-1 ring-inset ring-black/10', dim, className)} style={style} />;
}

export function Thumb({ src, alt, size = 'md', className }: { src: string | null | undefined; alt?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dim = size === 'sm' ? 'size-8' : size === 'lg' ? 'size-16' : 'size-10';
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-inset ring-black/5', dim, className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt ?? ''} className="size-full object-cover" loading="lazy" />
      ) : (
        <span className="text-[10px] text-muted-foreground">—</span>
      )}
    </span>
  );
}

export function KeyValue({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-[120px_1fr] gap-2 py-1 text-sm', className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function Section({ title, description, actions, children, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border bg-card', className)}>
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
