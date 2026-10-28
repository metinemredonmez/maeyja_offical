'use client';

import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime } from '@/components/shared/primitives';
import { ToneBadge } from '@/components/shared/status-badge';
import { useListParams } from '@/hooks/use-list-params';
import { fullName } from '@/lib/format';
import { useAuditLogs } from '@/lib/queries/system';
import type { AuditLog } from '@/lib/types';

const METHOD_TONE = { POST: 'success', PATCH: 'info', PUT: 'info', DELETE: 'danger' } as const;

function AuditList() {
  const { params, set, page, limit } = useListParams({ q: '' });
  const query = useAuditLogs({ page, limit, q: params.q || undefined });
  const [meta, setMeta] = useState<AuditLog | null>(null);

  const columns: Column<AuditLog>[] = [
    { key: 'date', header: 'Tarih', cell: (l) => <DateTime value={l.createdAt} className="text-xs" /> },
    { key: 'actor', header: 'Kullanıcı', cell: (l) => (l.actor ? <span className="text-xs">{l.actor.firstName ?? fullName(l.actor)} <span className="text-muted-foreground">· {l.actor.email}</span></span> : <span className="text-xs text-muted-foreground">Sistem</span>) },
    {
      key: 'action',
      header: 'İşlem',
      cell: (l) => {
        const method = l.action.split(' ')[0] as keyof typeof METHOD_TONE;
        const path = l.action.slice(method.length + 1);
        return (
          <span className="flex items-center gap-2 font-mono text-xs">
            <ToneBadge tone={METHOD_TONE[method] ?? 'neutral'}>{method}</ToneBadge>
            <span className="truncate">{path}</span>
          </span>
        );
      },
    },
    { key: 'entity', header: 'Kayıt', cell: (l) => <span className="font-mono text-[11px] text-muted-foreground">{[l.entity, l.entityId].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'ip', header: 'IP', align: 'right', cell: (l) => <span className="font-mono text-[11px] text-muted-foreground">{l.ip ?? '—'}</span> },
    {
      key: 'meta',
      header: '',
      align: 'right',
      cell: (l) =>
        l.meta ? (
          <Button variant="ghost" size="sm" onClick={() => setMeta(l)}>
            Detay
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="İşlem kayıtları" description="Yönetim panelinde yapılan tüm yazma işlemleri." />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(l) => l.id}
        total={query.data?.total}
        page={page}
        limit={limit}
        onPageChange={(p) => set({ page: p })}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        emptyTitle="Kayıt yok"
        search={{ value: params.q, onChange: (q) => set({ q }), placeholder: 'İşlem yolu veya kayıt id…' }}
        dense
      />
      {meta && (
        <Dialog open onOpenChange={(o) => !o && setMeta(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">{meta.action}</DialogTitle>
              <DialogDescription>
                <DateTime value={meta.createdAt} /> · {meta.actor?.email ?? 'Sistem'}
              </DialogDescription>
            </DialogHeader>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{JSON.stringify(meta.meta, null, 2)}</pre>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default function AuditLogsPage() {
  return (
    <Suspense fallback={null}>
      <AuditList />
    </Suspense>
  );
}
