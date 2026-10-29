'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Field, FormError, SubmitButton, SwitchField } from '@/components/shared/form';
import { ImageUrlField } from '@/components/shared/media-picker';
import { PageHeader } from '@/components/shared/page-header';
import { Thumb } from '@/components/shared/primitives';
import { SeoFields } from '@/components/shared/seo-fields';
import { StatusBadge } from '@/components/shared/status-badge';
import { TranslationsTabs } from '@/components/shared/translations-tabs';
import { cleanTranslations } from '@/lib/i18n';
import { useCollections, useDeleteCollection, useSaveCollection } from '@/lib/queries/catalog';
import { collectionSchema, type CollectionFormValues } from '@/lib/schemas/catalog';
import type { Collection } from '@/lib/types';

function CollectionDialog({ open, onOpenChange, collection }: { open: boolean; onOpenChange: (o: boolean) => void; collection: Collection | null }) {
  const save = useSaveCollection();
  const form = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      name: collection?.name ?? '',
      slug: collection?.slug ?? '',
      description: collection?.description ?? '',
      coverImageUrl: collection?.coverImageUrl ?? '',
      sortOrder: collection?.sortOrder != null ? String(collection.sortOrder) : '',
      isActive: collection?.isActive ?? true,
      translations: (collection?.translations as Record<string, Record<string, string>>) ?? {},
      seoTitle: collection?.seoTitle ?? '',
      seoDescription: collection?.seoDescription ?? '',
    },
  });
  const onSubmit = form.handleSubmit(async (raw) => {
    const v = collectionSchema.parse(raw);
    const nul = <T,>(x: T | undefined) => x ?? (collection ? null : undefined);
    await save.mutateAsync({
      id: collection?.id,
      body: {
        name: v.name,
        slug: v.slug || undefined,
        description: nul(v.description),
        coverImageUrl: nul(v.coverImageUrl),
        sortOrder: v.sortOrder,
        isActive: v.isActive,
        translations: cleanTranslations(v.translations) ?? {},
        seoTitle: nul(v.seoTitle),
        seoDescription: nul(v.seoDescription),
      },
    });
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{collection ? 'Koleksiyonu düzenle' : 'Yeni koleksiyon'}</DialogTitle>
          <DialogDescription>Sezon veya tema bazlı ürün seçkisi.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError error={save.error} />
          <TranslationsTabs kind="collection"
            form={form}
            fields={[
              { name: 'name', label: 'Ad', required: true, maxLength: 80 },
              { name: 'description', label: 'Açıklama', type: 'textarea', rows: 3, maxLength: 2000 },
            ]}
            extraBase={
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Slug" error={form.formState.errors.slug} htmlFor="col-slug" hint="Boşsa addan üretilir">
                  <Input id="col-slug" className="font-mono text-xs" {...form.register('slug')} />
                </Field>
                <Field label="Sıra" error={form.formState.errors.sortOrder} htmlFor="col-sort">
                  <Input id="col-sort" type="number" step={1} {...form.register('sortOrder')} />
                </Field>
                <Controller control={form.control} name="isActive" render={({ field }) => <SwitchField label="Aktif" checked={field.value} onCheckedChange={field.onChange} />} />
                <Field label="Kapak görseli" className="sm:col-span-2">
                  <Controller control={form.control} name="coverImageUrl" render={({ field }) => <ImageUrlField value={field.value} onChange={field.onChange} id="col-cover" />} />
                </Field>
              </div>
            }
          />
          <SeoFields register={form.register} errors={form.formState.errors} watch={(n) => form.watch(n)} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <SubmitButton loading={save.isPending}>Kaydet</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CollectionsPage() {
  const query = useCollections();
  const del = useDeleteCollection();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Collection | null | undefined>(undefined);

  const columns: Column<Collection>[] = [
    {
      key: 'name',
      header: 'Koleksiyon',
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Thumb src={c.coverImageUrl} size="sm" />
          <div>
            <p className="font-medium">{c.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{c.slug}</p>
          </div>
        </div>
      ),
    },
    { key: 'count', header: 'Ürün', align: 'right', cell: (c) => <span className="tabular-nums">{c._count?.products ?? 0}</span> },
    { key: 'sort', header: 'Sıra', align: 'right', cell: (c) => <span className="tabular-nums text-muted-foreground">{c.sortOrder}</span> },
    { key: 'active', header: 'Durum', cell: (c) => <StatusBadge kind="active" value={c.isActive} /> },
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
            onClick={() => confirm.ask({ title: `"${c.name}" silinsin mi?`, description: 'Ürünler koleksiyondan çıkar; ürünler silinmez.', confirmLabel: 'Sil', destructive: true, onConfirm: () => del.mutateAsync(c.id) })}
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
        title="Koleksiyonlar"
        description={query.data ? `${query.data.length} koleksiyon` : undefined}
        actions={
          <Button onClick={() => setEditing(null)}>
            <PlusIcon /> Yeni koleksiyon
          </Button>
        }
      />
      <DataTable columns={columns} rows={query.data} rowKey={(c) => c.id} isLoading={query.isPending} error={query.error} onRetry={() => query.refetch()} emptyTitle="Koleksiyon yok" />
      {editing !== undefined && <CollectionDialog open onOpenChange={(o) => !o && setEditing(undefined)} collection={editing} />}
      {confirm.dialog}
    </>
  );
}
