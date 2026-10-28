'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { SimpleSelect } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime, Thumb } from '@/components/shared/primitives';
import { StatusBadge } from '@/components/shared/status-badge';
import { useListParams } from '@/hooks/use-list-params';
import { CONTENT_STATUS } from '@/lib/labels';
import { useDeleteJournalPost, useJournal } from '@/lib/queries/content';
import type { ContentStatus, JournalPost } from '@/lib/types';

function JournalList() {
  const { params, set, page, limit } = useListParams({ q: '', status: '' });
  const query = useJournal({ page, limit, q: params.q || undefined, status: (params.status as ContentStatus) || undefined });
  const del = useDeleteJournalPost();
  const confirm = useConfirm();
  const columns: Column<JournalPost>[] = [
    {
      key: 'title',
      header: 'Yazı',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <Thumb src={p.coverImageUrl} alt={p.title} />
          <div className="min-w-0">
            <p className="truncate font-medium">{p.title}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">/journal/{p.slug}</p>
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Durum', cell: (p) => <StatusBadge kind="content" value={p.status} /> },
    { key: 'published', header: 'Yayın', align: 'right', cell: (p) => <DateTime value={p.publishedAt} mode="date" className="text-xs text-muted-foreground" /> },
    { key: 'updated', header: 'Güncellendi', align: 'right', cell: (p) => <DateTime value={p.updatedAt} mode="relative" className="text-xs text-muted-foreground" /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-[#A3121B]" aria-label="Sil" onClick={() => confirm.ask({ title: `"${p.title}" silinsin mi?`, description: 'Yazı kalıcı olarak silinir.', confirmLabel: 'Sil', destructive: true, onConfirm: () => del.mutateAsync(p.id) })}>
          <Trash2Icon />
        </Button>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Journal"
        description={query.data ? `${query.data.total} yazı` : undefined}
        actions={
          <Button render={<Link href="/content/journal/new" />}>
            <PlusIcon /> Yeni yazı
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(p) => p.id}
        rowHref={(p) => `/content/journal/${p.id}`}
        total={query.data?.total}
        page={page}
        limit={limit}
        onPageChange={(p) => set({ page: p })}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        emptyTitle="Yazı yok"
        search={{ value: params.q, onChange: (q) => set({ q }), placeholder: 'Başlıkta ara…' }}
        toolbar={<SimpleSelect value={params.status} onChange={(v) => set({ status: v })} allowEmpty emptyLabel="Tüm durumlar" className="w-36" options={(Object.keys(CONTENT_STATUS) as ContentStatus[]).map((s) => ({ value: s, label: CONTENT_STATUS[s].label }))} ariaLabel="Durum" />}
      />
      {confirm.dialog}
    </>
  );
}

export default function JournalPage() {
  return (
    <Suspense fallback={null}>
      <JournalList />
    </Suspense>
  );
}
