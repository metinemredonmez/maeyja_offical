'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLinkIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Field, FormError, SubmitButton, SwitchField } from '@/components/shared/form';
import { ImageUrlField } from '@/components/shared/media-picker';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime, Thumb } from '@/components/shared/primitives';
import { StatusBadge } from '@/components/shared/status-badge';
import { fromLocalInput, toLocalInput } from '@/lib/format';
import { useDeletePress, usePress, useSavePress } from '@/lib/queries/content';
import { pressSchema, type PressFormValues } from '@/lib/schemas/content';
import type { PressItem } from '@/lib/types';

function PressDialog({ item, onClose }: { item: PressItem | null; onClose: () => void }) {
  const save = useSavePress();
  const form = useForm<PressFormValues>({
    resolver: zodResolver(pressSchema),
    defaultValues: {
      publication: item?.publication ?? '',
      title: item?.title ?? '',
      quote: item?.quote ?? '',
      url: item?.url ?? '',
      logoUrl: item?.logoUrl ?? '',
      imageUrl: item?.imageUrl ?? '',
      publishedAt: toLocalInput(item?.publishedAt),
      sortOrder: item?.sortOrder != null ? String(item.sortOrder) : '',
      isActive: item?.isActive ?? true,
    },
  });
  const onSubmit = form.handleSubmit(async (raw) => {
    const v = pressSchema.parse(raw);
    const nul = <T,>(x: T | undefined) => x ?? (item ? null : undefined);
    await save.mutateAsync({
      id: item?.id,
      body: { publication: v.publication, title: nul(v.title), quote: nul(v.quote), url: nul(v.url), logoUrl: nul(v.logoUrl), imageUrl: nul(v.imageUrl), publishedAt: v.publishedAt ? fromLocalInput(v.publishedAt) : item ? null : undefined, sortOrder: v.sortOrder, isActive: v.isActive },
    });
    onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Basın öğesini düzenle' : 'Yeni basın öğesi'}</DialogTitle>
          <DialogDescription>“Basında” bölümünde logo ve alıntı olarak görünür.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError error={save.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Yayın" error={form.formState.errors.publication} htmlFor="publication" required>
              <Input id="publication" placeholder="Vogue Türkiye" maxLength={80} {...form.register('publication')} />
            </Field>
            <Field label="Tarih" error={form.formState.errors.publishedAt} htmlFor="publishedAt">
              <Input id="publishedAt" type="datetime-local" {...form.register('publishedAt')} />
            </Field>
            <Field label="Başlık" error={form.formState.errors.title} htmlFor="title" className="sm:col-span-2">
              <Input id="title" maxLength={200} {...form.register('title')} />
            </Field>
            <Field label="Alıntı" error={form.formState.errors.quote} htmlFor="quote" className="sm:col-span-2">
              <Textarea id="quote" rows={3} maxLength={400} {...form.register('quote')} />
            </Field>
            <Field label="Haber adresi" error={form.formState.errors.url} htmlFor="url" className="sm:col-span-2">
              <Input id="url" placeholder="https://…" {...form.register('url')} />
            </Field>
            <Field label="Logo" error={form.formState.errors.logoUrl}>
              <Controller control={form.control} name="logoUrl" render={({ field }) => <ImageUrlField value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Görsel" error={form.formState.errors.imageUrl}>
              <Controller control={form.control} name="imageUrl" render={({ field }) => <ImageUrlField value={field.value} onChange={field.onChange} />} />
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

export default function PressPage() {
  const query = usePress();
  const del = useDeletePress();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<PressItem | null | undefined>(undefined);
  const columns: Column<PressItem>[] = [
    {
      key: 'pub',
      header: 'Yayın',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <Thumb src={p.logoUrl ?? p.imageUrl} alt={p.publication} />
          <div className="min-w-0">
            <p className="font-medium">{p.publication}</p>
            {p.title && <p className="truncate text-xs text-muted-foreground">{p.title}</p>}
          </div>
        </div>
      ),
    },
    { key: 'quote', header: 'Alıntı', cell: (p) => <span className="line-clamp-2 max-w-sm text-xs text-muted-foreground">{p.quote ?? '—'}</span> },
    {
      key: 'url',
      header: 'Bağlantı',
      cell: (p) =>
        p.url ? (
          <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline underline-offset-2">
            Aç <ExternalLinkIcon className="size-3" />
          </a>
        ) : (
          '—'
        ),
    },
    { key: 'date', header: 'Tarih', align: 'right', cell: (p) => <DateTime value={p.publishedAt} mode="date" className="text-xs text-muted-foreground" /> },
    { key: 'active', header: 'Durum', cell: (p) => <StatusBadge kind="active" value={p.isActive} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(p)} aria-label="Düzenle">
            <PencilIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-[#A3121B]" aria-label="Sil" onClick={() => confirm.ask({ title: `${p.publication} silinsin mi?`, confirmLabel: 'Sil', destructive: true, onConfirm: () => del.mutateAsync(p.id) })}>
            <Trash2Icon />
          </Button>
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="Basın"
        description={query.data ? `${query.data.length} öğe` : undefined}
        actions={
          <Button onClick={() => setEditing(null)}>
            <PlusIcon /> Yeni öğe
          </Button>
        }
      />
      <DataTable columns={columns} rows={query.data} rowKey={(p) => p.id} isLoading={query.isPending} error={query.error} onRetry={() => query.refetch()} emptyTitle="Basın öğesi yok" />
      {editing !== undefined && <PressDialog item={editing} onClose={() => setEditing(undefined)} />}
      {confirm.dialog}
    </>
  );
}
