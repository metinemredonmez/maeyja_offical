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
import { Field, FormError, SimpleSelect, SubmitButton, SwitchField } from '@/components/shared/form';
import { ImageUrlField } from '@/components/shared/media-picker';
import { PageHeader } from '@/components/shared/page-header';
import { Thumb } from '@/components/shared/primitives';
import { SeoFields } from '@/components/shared/seo-fields';
import { StatusBadge } from '@/components/shared/status-badge';
import { TranslationsTabs } from '@/components/shared/translations-tabs';
import { cleanTranslations } from '@/lib/i18n';
import { useCategories, useDeleteCategory, useSaveCategory } from '@/lib/queries/catalog';
import { categorySchema, type CategoryFormValues } from '@/lib/schemas/catalog';
import type { Category } from '@/lib/types';

function CategoryDialog({ open, onOpenChange, category, all }: { open: boolean; onOpenChange: (o: boolean) => void; category: Category | null; all: Category[] }) {
  const save = useSaveCategory();
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      description: category?.description ?? '',
      imageUrl: category?.imageUrl ?? '',
      parentId: category?.parentId ?? '',
      sortOrder: category?.sortOrder != null ? String(category.sortOrder) : '',
      isActive: category?.isActive ?? true,
      translations: (category?.translations as Record<string, Record<string, string>>) ?? {},
      seoTitle: category?.seoTitle ?? '',
      seoDescription: category?.seoDescription ?? '',
    },
  });
  const onSubmit = form.handleSubmit(async (raw) => {
    const v = categorySchema.parse(raw);
    await save.mutateAsync({
      id: category?.id,
      body: {
        name: v.name,
        slug: v.slug || undefined,
        description: v.description ?? (category ? null : undefined),
        imageUrl: v.imageUrl ?? (category ? null : undefined),
        parentId: v.parentId || null,
        sortOrder: v.sortOrder,
        isActive: v.isActive,
        translations: cleanTranslations(v.translations) ?? {},
        seoTitle: v.seoTitle ?? (category ? null : undefined),
        seoDescription: v.seoDescription ?? (category ? null : undefined),
      },
    });
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{category ? 'Kategoriyi düzenle' : 'Yeni kategori'}</DialogTitle>
          <DialogDescription>Vitrindeki ürün gruplaması.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError error={save.error} />
          <TranslationsTabs kind="product category"
            form={form}
            fields={[
              { name: 'name', label: 'Ad', required: true, maxLength: 80 },
              { name: 'description', label: 'Açıklama', type: 'textarea', rows: 3, maxLength: 1000 },
            ]}
            extraBase={
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Slug" error={form.formState.errors.slug} htmlFor="cat-slug" hint="Boşsa addan üretilir">
                  <Input id="cat-slug" className="font-mono text-xs" {...form.register('slug')} />
                </Field>
                <Field label="Üst kategori" htmlFor="cat-parent">
                  <Controller control={form.control} name="parentId" render={({ field }) => <SimpleSelect id="cat-parent" value={field.value ?? ''} onChange={field.onChange} allowEmpty emptyLabel="Ana kategori" options={all.filter((c) => c.id !== category?.id).map((c) => ({ value: c.id, label: c.name }))} />} />
                </Field>
                <Field label="Sıra" error={form.formState.errors.sortOrder} htmlFor="cat-sort">
                  <Input id="cat-sort" type="number" step={1} {...form.register('sortOrder')} />
                </Field>
                <Controller control={form.control} name="isActive" render={({ field }) => <SwitchField label="Aktif" checked={field.value} onCheckedChange={field.onChange} className="self-end" />} />
                <Field label="Görsel" className="sm:col-span-2">
                  <Controller control={form.control} name="imageUrl" render={({ field }) => <ImageUrlField value={field.value} onChange={field.onChange} id="cat-image" />} />
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

export default function CategoriesPage() {
  const query = useCategories();
  const del = useDeleteCategory();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const all = query.data ?? [];
  const byId = new Map(all.map((c) => [c.id, c]));

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'Kategori',
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Thumb src={c.imageUrl} size="sm" />
          <div>
            <p className="font-medium">
              {c.parentId && <span className="text-muted-foreground">{byId.get(c.parentId)?.name} / </span>}
              {c.name}
            </p>
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
            onClick={() =>
              confirm.ask({
                title: `"${c.name}" silinsin mi?`,
                description: 'Kategorideki ürünler kategorisiz kalır; alt kategoriler ana kategoriye taşınır.',
                confirmLabel: 'Sil',
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
        title="Kategoriler"
        description={query.data ? `${query.data.length} kategori` : undefined}
        actions={
          <Button onClick={() => setEditing(null)}>
            <PlusIcon /> Yeni kategori
          </Button>
        }
      />
      <DataTable columns={columns} rows={query.data} rowKey={(c) => c.id} isLoading={query.isPending} error={query.error} onRetry={() => query.refetch()} emptyTitle="Kategori yok" />
      {editing !== undefined && <CategoryDialog open onOpenChange={(o) => !o && setEditing(undefined)} category={editing} all={all} />}
      {confirm.dialog}
    </>
  );
}
