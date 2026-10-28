'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Field, FormError, SimpleSelect, SubmitButton } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime, Money } from '@/components/shared/primitives';
import { StatusBadge } from '@/components/shared/status-badge';
import { useListParams } from '@/hooks/use-list-params';
import { RETURN_STATUS, RETURN_STATUSES } from '@/lib/labels';
import { useReturns, useUpdateReturn } from '@/lib/queries/orders';
import { returnUpdateSchema, type ReturnUpdateValues } from '@/lib/schemas/orders';
import type { ReturnRequest, ReturnStatus } from '@/lib/types';

function UpdateDialog({ rr, onClose }: { rr: ReturnRequest; onClose: () => void }) {
  const update = useUpdateReturn();
  const form = useForm<ReturnUpdateValues>({ resolver: zodResolver(returnUpdateSchema), defaultValues: { status: rr.status, adminNote: rr.adminNote ?? '' } });
  const onSubmit = form.handleSubmit(async (raw) => {
    const v = returnUpdateSchema.parse(raw);
    await update.mutateAsync({ id: rr.id, status: v.status, adminNote: v.adminNote });
    onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>İade talebini güncelle</DialogTitle>
          <DialogDescription>
            Sipariş {rr.order?.orderNumber} · {rr.email}. Müşteriye durum e-postası gönderilir.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Sebep</p>
          <p>{rr.reason}</p>
          <p className="mt-2 text-xs text-muted-foreground">Ürünler</p>
          <ul className="text-xs">
            {rr.items.map((i) => (
              <li key={i.orderItemId}>
                {rr.order?.items.find((x) => x.id === i.orderItemId)?.productName ?? i.orderItemId} × {i.quantity}
              </li>
            ))}
          </ul>
        </div>
        <form onSubmit={onSubmit} className="grid gap-3" noValidate>
          <FormError error={update.error} />
          <Field label="Durum" htmlFor="rr-status" required>
            <Controller control={form.control} name="status" render={({ field }) => <SimpleSelect id="rr-status" value={field.value} onChange={field.onChange} options={RETURN_STATUSES.map((s) => ({ value: s, label: RETURN_STATUS[s].label }))} />} />
          </Field>
          <Field label="Yönetici notu" error={form.formState.errors.adminNote} htmlFor="rr-note">
            <Textarea id="rr-note" rows={3} maxLength={1000} {...form.register('adminNote')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <SubmitButton loading={update.isPending}>Kaydet</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReturnsList() {
  const { params, set, page, limit } = useListParams({ status: '' });
  const query = useReturns({ page, limit, status: (params.status as ReturnStatus) || undefined });
  const [editing, setEditing] = useState<ReturnRequest | null>(null);

  const columns: Column<ReturnRequest>[] = [
    {
      key: 'order',
      header: 'Sipariş',
      cell: (r) =>
        r.order ? (
          <Link href={`/orders/${r.order.id}`} className="font-medium tabular-nums hover:underline">
            {r.order.orderNumber}
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'email', header: 'Müşteri', cell: (r) => <span className="text-muted-foreground">{r.email}</span> },
    { key: 'reason', header: 'Sebep', cell: (r) => <span className="line-clamp-2 max-w-xs text-xs">{r.reason}</span> },
    { key: 'items', header: 'Ürün', align: 'right', cell: (r) => <span className="tabular-nums">{r.items.reduce((n, i) => n + i.quantity, 0)}</span> },
    { key: 'total', header: 'Sipariş tutarı', align: 'right', cell: (r) => (r.order ? <Money value={r.order.total} muted /> : '—') },
    { key: 'status', header: 'Durum', cell: (r) => <StatusBadge kind="return" value={r.status} /> },
    { key: 'date', header: 'Tarih', align: 'right', cell: (r) => <DateTime value={r.createdAt} className="text-xs text-muted-foreground" /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
          Güncelle
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="İadeler" description={query.data ? `${query.data.total} talep` : undefined} />
      <Tabs value={params.status || 'ALL'} onValueChange={(v) => set({ status: v === 'ALL' ? '' : String(v) })} className="mb-3">
        <TabsList variant="line" className="h-auto flex-wrap justify-start border-b pb-0">
          <TabsTrigger value="ALL" className="h-8 flex-none px-2 text-xs">
            Tümü
          </TabsTrigger>
          {RETURN_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} className="h-8 flex-none px-2 text-xs">
              {RETURN_STATUS[s].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTable columns={columns} rows={query.data?.items} rowKey={(r) => r.id} total={query.data?.total} page={page} limit={limit} onPageChange={(p) => set({ page: p })} isLoading={query.isPending} isFetching={query.isFetching} error={query.error} onRetry={() => query.refetch()} emptyTitle="İade talebi yok" />
      {editing && <UpdateDialog rr={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense fallback={null}>
      <ReturnsList />
    </Suspense>
  );
}
