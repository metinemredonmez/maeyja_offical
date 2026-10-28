'use client';

import { Suspense } from 'react';
import { DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/shared/data-table';
import { SimpleSelect } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime, Money } from '@/components/shared/primitives';
import { StatusBadge, ToneBadge } from '@/components/shared/status-badge';
import { useListParams } from '@/hooks/use-list-params';
import { qs } from '@/lib/api.client';
import { ORDER_STATUS, ORDER_STATUSES, PAYMENT_PROVIDER } from '@/lib/labels';
import { formatNumber } from '@/lib/format';
import { useOrders } from '@/lib/queries/orders';
import type { OrderListItem, OrderStatus, PaymentProvider } from '@/lib/types';

const DEFAULTS = { q: '', status: '', provider: '', from: '', to: '' };

function OrdersList() {
  const { params, set, page, limit } = useListParams(DEFAULTS);
  const filters = { q: params.q || undefined, status: (params.status as OrderStatus) || undefined, provider: (params.provider as PaymentProvider) || undefined, from: params.from || undefined, to: params.to ? `${params.to}T23:59:59` : undefined };
  const query = useOrders({ page, limit, ...filters });
  const counts = query.data?.statusCounts ?? {};
  const all = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const exportHref = `/api/admin/orders/export.csv${qs(filters)}`;

  const columns: Column<OrderListItem>[] = [
    { key: 'no', header: 'Sipariş', cell: (o) => <span className="font-medium tabular-nums">{o.orderNumber}</span> },
    {
      key: 'customer',
      header: 'Müşteri',
      cell: (o) => (
        <div className="min-w-0">
          <p className="truncate">
            {o.customerName || '—'} {o.isGuest && <ToneBadge tone="muted">misafir</ToneBadge>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {o.email}
            {o.city ? ` · ${o.city}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Durum', cell: (o) => <StatusBadge kind="order" value={o.status} /> },
    { key: 'payment', header: 'Ödeme', cell: (o) => <span className="text-xs text-muted-foreground">{PAYMENT_PROVIDER[o.paymentProvider]}</span> },
    { key: 'items', header: 'Ürün', align: 'right', cell: (o) => <span className="tabular-nums">{o.itemCount}</span> },
    { key: 'total', header: 'Tutar', align: 'right', cell: (o) => <Money value={o.total} className="font-medium" /> },
    { key: 'date', header: 'Tarih', align: 'right', cell: (o) => <DateTime value={o.createdAt} className="text-xs text-muted-foreground" /> },
  ];

  return (
    <>
      <PageHeader
        title="Siparişler"
        description={query.data ? `${formatNumber(query.data.total)} sipariş listeleniyor` : undefined}
        actions={
          <Button variant="outline" render={<a href={exportHref} download />}>
            <DownloadIcon /> CSV dışa aktar
          </Button>
        }
      />
      <Tabs value={params.status || 'ALL'} onValueChange={(v) => set({ status: v === 'ALL' ? '' : String(v) })} className="mb-3">
        <TabsList variant="line" className="h-auto flex-wrap justify-start border-b pb-0">
          <TabsTrigger value="ALL" className="h-8 flex-none px-2 text-xs">
            Tümü <span className="text-muted-foreground tabular-nums">{formatNumber(all)}</span>
          </TabsTrigger>
          {ORDER_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} className="h-8 flex-none px-2 text-xs">
              {ORDER_STATUS[s].label} <span className="text-muted-foreground tabular-nums">{formatNumber(counts[s] ?? 0)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(o) => o.id}
        rowHref={(o) => `/orders/${o.id}`}
        total={query.data?.total}
        page={page}
        limit={limit}
        onPageChange={(p) => set({ page: p })}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        emptyTitle="Sipariş bulunamadı"
        search={{ value: params.q, onChange: (q) => set({ q }), placeholder: 'Sipariş no, e-posta, telefon, takip no…' }}
        toolbar={
          <>
            <SimpleSelect value={params.provider} onChange={(v) => set({ provider: v })} allowEmpty emptyLabel="Tüm ödemeler" className="w-40" options={(Object.keys(PAYMENT_PROVIDER) as PaymentProvider[]).map((p) => ({ value: p, label: PAYMENT_PROVIDER[p] }))} ariaLabel="Ödeme yöntemi" />
            <Input type="date" value={params.from} onChange={(e) => set({ from: e.target.value })} className="w-36" aria-label="Başlangıç tarihi" />
            <span className="text-xs text-muted-foreground">–</span>
            <Input type="date" value={params.to} onChange={(e) => set({ to: e.target.value })} className="w-36" aria-label="Bitiş tarihi" />
            {(params.from || params.to || params.provider || params.q) && (
              <Button variant="ghost" size="sm" onClick={() => set({ from: '', to: '', provider: '', q: '' })}>
                Filtreleri temizle
              </Button>
            )}
          </>
        }
      />
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersList />
    </Suspense>
  );
}
