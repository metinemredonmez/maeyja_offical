'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, ErrorState } from '@/components/shared/query-state';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'right' | 'center';
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  total?: number;
  page?: number;
  limit?: number;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  rowHref?: (row: T) => string | undefined;
  rowClassName?: (row: T) => string | undefined;
  toolbar?: React.ReactNode;
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  className?: string;
  dense?: boolean;
};

/** Debounced search box. Keeps its own text while typing; adopts an external value (e.g. "filtreleri temizle") unless it is just the echo of what it emitted. */
export function SearchInput({ value, onChange, placeholder = 'Ara…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const [local, setLocal] = useState(value);
  const [emitted, setEmitted] = useState(value);
  const [prev, setPrev] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (value !== prev) {
    setPrev(value);
    if (value !== emitted) setLocal(value);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const update = (v: string) => {
    setLocal(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setEmitted(v);
      onChange(v);
    }, 350);
  };

  return (
    <div className={cn('relative w-full max-w-xs', className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={local} onChange={(e) => update(e.target.value)} placeholder={placeholder} className="pl-8 pr-8" aria-label={placeholder} />
      {local && (
        <button type="button" onClick={() => update('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Temizle">
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, limit, total, onPageChange, className }: { page: number; limit: number; total: number; onPageChange: (p: number) => void; className?: string }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className={cn('flex items-center justify-between gap-3 text-xs text-muted-foreground', className)}>
      <span>
        {formatNumber(from)}–{formatNumber(to)} / {formatNumber(total)} kayıt
      </span>
      <div className="flex items-center gap-1">
        <span className="mr-2 tabular-nums">
          Sayfa {page} / {pages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Önceki sayfa">
          <ChevronLeftIcon />
        </Button>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Sonraki sayfa">
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  total,
  page = 1,
  limit = 20,
  onPageChange,
  isLoading,
  isFetching,
  error,
  onRetry,
  emptyTitle = 'Kayıt bulunamadı',
  emptyDescription,
  emptyAction,
  rowHref,
  rowClassName,
  toolbar,
  search,
  className,
  dense,
}: Props<T>) {
  const router = useRouter();
  const align = (a?: 'left' | 'right' | 'center') => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : '');

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {(search || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {search && <SearchInput value={search.value} onChange={search.onChange} placeholder={search.placeholder} />}
          {toolbar}
        </div>
      )}
      <div className={cn('overflow-hidden rounded-xl border bg-card transition-opacity', isFetching && !isLoading && 'opacity-70')}>
        {error ? (
          <ErrorState error={error} onRetry={onRetry} className="rounded-none border-0" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((c) => (
                  <TableHead key={c.key} className={cn('text-xs font-medium text-muted-foreground', align(c.align), c.headerClassName)}>
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`s${i}`}>
                    {columns.map((c) => (
                      <TableCell key={c.key}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!isLoading && rows && rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} className="rounded-none border-0" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                rows?.map((row) => {
                  const href = rowHref?.(row);
                  return (
                    <TableRow
                      key={rowKey(row)}
                      className={cn(href && 'cursor-pointer', dense && '[&>td]:py-1.5', rowClassName?.(row))}
                      onClick={(e) => {
                        if (!href) return;
                        const target = e.target as HTMLElement;
                        if (target.closest('a,button,input,select,textarea,[role=menu],[data-no-row-link]')) return;
                        router.push(href);
                      }}
                    >
                      {columns.map((c) => (
                        <TableCell key={c.key} className={cn(align(c.align), c.className)}>
                          {c.cell(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        )}
      </div>
      {total !== undefined && onPageChange && !error && <Pagination page={page} limit={limit} total={total} onPageChange={onPageChange} />}
    </div>
  );
}
