'use client';

import { Suspense } from 'react';
import { DownloadIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime } from '@/components/shared/primitives';
import { ToneBadge } from '@/components/shared/status-badge';
import { useListParams } from '@/hooks/use-list-params';
import { LOCALE_LABELS, type Locale } from '@/lib/i18n';
import { useDeleteSubscriber, useSubscribers } from '@/lib/queries/marketing';
import type { Subscriber } from '@/lib/types';

function NewsletterList() {
  const { params, set, page, limit } = useListParams({ q: '' });
  const query = useSubscribers({ page, limit, q: params.q || undefined });
  const del = useDeleteSubscriber();
  const confirm = useConfirm();
  const columns: Column<Subscriber>[] = [
    { key: 'email', header: 'E-posta', cell: (s) => <span className="font-medium">{s.email}</span> },
    { key: 'locale', header: 'Dil', cell: (s) => <ToneBadge tone="neutral">{LOCALE_LABELS[s.locale as Locale] ?? s.locale.toUpperCase()}</ToneBadge> },
    { key: 'source', header: 'Kaynak', cell: (s) => <span className="text-xs text-muted-foreground">{s.source ?? '—'}</span> },
    { key: 'date', header: 'Abone oldu', align: 'right', cell: (s) => <DateTime value={s.createdAt} className="text-xs text-muted-foreground" /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-[#A3121B]" aria-label="Sil" onClick={() => confirm.ask({ title: `${s.email} silinsin mi?`, description: 'Abone kalıcı olarak kaldırılır (KVKK silme talebi için).', confirmLabel: 'Sil', destructive: true, onConfirm: () => del.mutateAsync(s.id) })}>
          <Trash2Icon />
        </Button>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Bülten aboneleri"
        description={query.data ? `${query.data.total} aktif abone` : undefined}
        actions={
          <Button variant="outline" render={<a href="/api/admin/newsletter/export.csv" download />}>
            <DownloadIcon /> CSV dışa aktar
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(s) => s.id}
        total={query.data?.total}
        page={page}
        limit={limit}
        onPageChange={(p) => set({ page: p })}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        emptyTitle="Abone yok"
        search={{ value: params.q, onChange: (q) => set({ q }), placeholder: 'E-posta ara…' }}
        dense
      />
      {confirm.dialog}
    </>
  );
}

export default function NewsletterPage() {
  return (
    <Suspense fallback={null}>
      <NewsletterList />
    </Suspense>
  );
}
