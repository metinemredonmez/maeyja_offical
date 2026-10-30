'use client';

import Link from 'next/link';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime } from '@/components/shared/primitives';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDeletePage, usePages } from '@/lib/queries/content';
import type { Page } from '@/lib/types';

export default function PagesPage() {
  const query = usePages();
  const del = useDeletePage();
  const confirm = useConfirm();
  const columns: Column<Page>[] = [
    {
      key: 'title',
      header: 'Sayfa',
      cell: (p) => (
        <div>
          <p className="font-medium">{p.title}</p>
          <p className="font-mono text-[11px] text-muted-foreground">/{p.slug}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Durum', cell: (p) => <StatusBadge kind="content" value={p.status} /> },
    { key: 'langs', header: 'Çeviri', cell: (p) => <span className="text-xs text-muted-foreground">{p.translations ? Object.keys(p.translations).join(', ').toUpperCase() || '—' : '—'}</span> },
    { key: 'updated', header: 'Güncellendi', align: 'right', cell: (p) => <DateTime value={p.updatedAt} className="text-xs text-muted-foreground" /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-[#A3121B]"
          aria-label="Sil"
          onClick={() => confirm.ask({ title: `"${p.title}" silinsin mi?`, description: 'Sayfa sitede 404 verir. Yasal sayfaları silmek yerine taslağa alın.', confirmLabel: 'Sil', destructive: true, onConfirm: () => del.mutateAsync(p.id) })}
        >
          <Trash2Icon />
        </Button>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Sayfalar"
        description="Hakkımızda, kargo & iade, KVKK, mesafeli satış gibi statik sayfalar."
        actions={
          <Button render={<Link href="/content/pages/new" />}>
            <PlusIcon /> Yeni sayfa
          </Button>
        }
      />
      <DataTable columns={columns} rows={query.data} rowKey={(p) => p.id} rowHref={(p) => `/content/pages/${p.id}`} isLoading={query.isPending} error={query.error} onRetry={() => query.refetch()} emptyTitle="Sayfa yok" />
      {confirm.dialog}
    </>
  );
}
