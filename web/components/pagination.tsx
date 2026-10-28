'use client';

import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';

export function Pagination({ page, pages }: { page: number; pages: number }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  if (pages <= 1) return null;
  const href = (p: number) => {
    const next = new URLSearchParams(sp.toString());
    if (p === 1) next.delete('page');
    else next.set('page', String(p));
    const q = next.toString();
    return (q ? `${pathname}?${q}` : pathname) as never;
  };
  return (
    <nav aria-label="Pagination" className="mt-16 flex items-center justify-center gap-4 text-sm">
      {page > 1 ? <Link href={href(page - 1)} className="label hover:text-brand">←</Link> : null}
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <Link key={p} href={href(p)} aria-current={p === page ? 'page' : undefined} className={`h-9 w-9 text-center leading-9 ${p === page ? 'border-b border-ink' : 'text-muted hover:text-ink'}`}>
          {p}
        </Link>
      ))}
      {page < pages ? <Link href={href(page + 1)} className="label hover:text-brand">→</Link> : null}
    </nav>
  );
}
