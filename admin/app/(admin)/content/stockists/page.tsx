'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLinkIcon, MapPinIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Field, FormError, SubmitButton, SwitchField } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDeleteStockist, useSaveStockist, useStockists } from '@/lib/queries/content';
import { stockistSchema, type StockistFormValues } from '@/lib/schemas/content';
import type { Stockist } from '@/lib/types';

function StockistDialog({ item, onClose }: { item: Stockist | null; onClose: () => void }) {
  const save = useSaveStockist();
  const form = useForm<StockistFormValues>({
    resolver: zodResolver(stockistSchema),
    defaultValues: {
      name: item?.name ?? '',
      city: item?.city ?? '',
      country: item?.country ?? 'TR',
      address: item?.address ?? '',
      phone: item?.phone ?? '',
      url: item?.url ?? '',
      mapUrl: item?.mapUrl ?? '',
      sortOrder: item?.sortOrder != null ? String(item.sortOrder) : '',
      isActive: item?.isActive ?? true,
    },
  });
  const onSubmit = form.handleSubmit(async (raw) => {
    const v = stockistSchema.parse(raw);
    const nul = <T,>(x: T | undefined) => x ?? (item ? null : undefined);
    await save.mutateAsync({ id: item?.id, body: { name: v.name, city: v.city, country: v.country, address: nul(v.address), phone: nul(v.phone), url: nul(v.url), mapUrl: nul(v.mapUrl), sortOrder: v.sortOrder, isActive: v.isActive } });
    onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? 'Satış noktasını düzenle' : 'Yeni satış noktası'}</DialogTitle>
          <DialogDescription>Mağaza / butik bilgileri “Satış Noktaları” sayfasında listelenir.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError error={save.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ad" error={form.formState.errors.name} htmlFor="name" required className="sm:col-span-2">
              <Input id="name" placeholder="Beymen İstinye" maxLength={120} {...form.register('name')} />
            </Field>
            <Field label="Şehir" error={form.formState.errors.city} htmlFor="city" required>
              <Input id="city" maxLength={60} {...form.register('city')} />
            </Field>
            <Field label="Ülke (ISO-2)" error={form.formState.errors.country} htmlFor="country">
              <Input id="country" maxLength={2} className="uppercase" {...form.register('country')} />
            </Field>
            <Field label="Adres" error={form.formState.errors.address} htmlFor="address" className="sm:col-span-2">
              <Textarea id="address" rows={2} maxLength={300} {...form.register('address')} />
            </Field>
            <Field label="Telefon" error={form.formState.errors.phone} htmlFor="phone">
              <Input id="phone" maxLength={30} {...form.register('phone')} />
            </Field>
            <Field label="Web" error={form.formState.errors.url} htmlFor="url">
              <Input id="url" placeholder="https://…" {...form.register('url')} />
            </Field>
            <Field label="Harita bağlantısı" error={form.formState.errors.mapUrl} htmlFor="mapUrl" className="sm:col-span-2">
              <Input id="mapUrl" placeholder="https://maps.google.com/…" {...form.register('mapUrl')} />
            </Field>
            <Field label="Sıra" error={form.formState.errors.sortOrder} htmlFor="sortOrder">
              <Input id="sortOrder" type="number" step={1} {...form.register('sortOrder')} />
            </Field>
            <Controller control={form.control} name="isActive" render={({ field }) => <SwitchField label="Yayında" checked={field.value} onCheckedChange={field.onChange} className="self-end" />} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <SubmitButton loading={save.isPending}>Kaydet</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StockistsPage() {
  const query = useStockists();
  const del = useDeleteStockist();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Stockist | null | undefined>(undefined);
  const columns: Column<Stockist>[] = [
    {
      key: 'name',
      header: 'Satış noktası',
      cell: (s) => (
        <div>
          <p className="font-medium">{s.name}</p>
          {s.address && <p className="truncate text-xs text-muted-foreground">{s.address}</p>}
        </div>
      ),
    },
    {
      key: 'city',
      header: 'Şehir',
      cell: (s) => (
        <span>
          {s.city}
          {s.country !== 'TR' ? ` · ${s.country}` : ''}
        </span>
      ),
    },
    { key: 'phone', header: 'Telefon', cell: (s) => <span className="text-xs text-muted-foreground">{s.phone ?? '—'}</span> },
    {
      key: 'links',
      header: 'Bağlantılar',
      cell: (s) => (
        <span className="flex gap-2 text-xs">
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
              Web <ExternalLinkIcon className="size-3" />
            </a>
          )}
          {s.mapUrl && (
            <a href={s.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
              Harita <MapPinIcon className="size-3" />
            </a>
          )}
        </span>
      ),
    },
    { key: 'active', header: 'Durum', cell: (s) => <StatusBadge kind="active" value={s.isActive} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(s)} aria-label="Düzenle">
            <PencilIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-[#A3121B]" aria-label="Sil" onClick={() => confirm.ask({ title: `${s.name} silinsin mi?`, confirmLabel: 'Sil', destructive: true, onConfirm: () => del.mutateAsync(s.id) })}>
            <Trash2Icon />
          </Button>
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Satış noktaları"
        description={query.data ? `${query.data.length} nokta` : undefined}
        actions={
          <Button onClick={() => setEditing(null)}>
            <PlusIcon /> Yeni nokta
          </Button>
        }
      />
      <DataTable columns={columns} rows={query.data} rowKey={(s) => s.id} isLoading={query.isPending} error={query.error} onRetry={() => query.refetch()} emptyTitle="Satış noktası yok" />
      {editing !== undefined && <StockistDialog item={editing} onClose={() => setEditing(undefined)} />}
      {confirm.dialog}
    </>
  );
}
