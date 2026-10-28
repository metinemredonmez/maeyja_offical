'use client';

import { Suspense, useState } from 'react';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CouponDialog } from '@/components/sales/coupon-dialog';
import { couponValue, couponWindow } from '@/components/sales/coupon-utils';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime, Money } from '@/components/shared/primitives';
import { useListParams } from '@/hooks/use-list-params';
import { COUPON_TYPE } from '@/lib/labels';
import { useCoupons, useDeleteCoupon } from '@/lib/queries/orders';
import type { Coupon } from '@/lib/types';

function CouponsList() {
  const { params, set, page, limit } = useListParams({ q: '' });
  const query = useCoupons({ page, limit, q: params.q || undefined });
  const del = useDeleteCoupon();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Coupon | null | undefined>(undefined);

  const columns: Column<Coupon>[] = [
    {
      key: 'code',
      header: 'Kod',
      cell: (c) => (
        <div>
          <p className="font-mono font-medium">{c.code}</p>
          {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
        </div>
      ),
    },
    { key: 'type', header: 'Tür', cell: (c) => <span className="text-xs text-muted-foreground">{COUPON_TYPE[c.type]}</span> },
    { key: 'value', header: 'İndirim', align: 'right', cell: (c) => <span className="tabular-nums">{couponValue(c)}</span> },
    { key: 'min', header: 'Min. sipariş', align: 'right', cell: (c) => (c.minOrderAmount != null ? <Money value={c.minOrderAmount} muted /> : <span className="text-muted-foreground">—</span>) },
    {
      key: 'usage',
      header: 'Kullanım',
      align: 'right',
      cell: (c) => (
        <span className="tabular-nums">
          {c.usedCount}
          {c.usageLimit ? ` / ${c.usageLimit}` : ''}
        </span>
      ),
    },
    {
      key: 'window',
      header: 'Geçerlilik',
      cell: (c) => (
        <div className="flex flex-col gap-0.5">
          {couponWindow(c)}
          {(c.startsAt || c.endsAt) && (
            <span className="text-[11px] text-muted-foreground">
              <DateTime value={c.startsAt} mode="date" /> – <DateTime value={c.endsAt} mode="date" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(c)} aria-label="Düzenle">
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-[#A3121B]"
            aria-label="Sil"
            onClick={() =>
              confirm.ask({
                title: `${c.code} silinsin mi?`,
                description: c.usedCount > 0 ? 'Kupon kullanılmış; silinmez, pasife alınır (sipariş geçmişi korunur).' : 'Kupon kalıcı olarak silinir.',
                confirmLabel: c.usedCount > 0 ? 'Pasife al' : 'Sil',
                destructive: true,
                onConfirm: () => del.mutateAsync(c.id),
              })
            }
          >
            <Trash2Icon />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Kuponlar"
        description={query.data ? `${query.data.total} kupon` : undefined}
        actions={
          <Button onClick={() => setEditing(null)}>
            <PlusIcon /> Yeni kupon
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(c) => c.id}
        rowHref={(c) => `/coupons/${c.id}`}
        total={query.data?.total}
        page={page}
        limit={limit}
        onPageChange={(p) => set({ page: p })}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        emptyTitle="Kupon yok"
        search={{ value: params.q, onChange: (q) => set({ q }), placeholder: 'Kod ara…' }}
      />
      {editing !== undefined && <CouponDialog coupon={editing} onClose={() => setEditing(undefined)} />}
      {confirm.dialog}
    </>
  );
}

export default function CouponsPage() {
  return (
    <Suspense fallback={null}>
      <CouponsList />
    </Suspense>
  );
}
