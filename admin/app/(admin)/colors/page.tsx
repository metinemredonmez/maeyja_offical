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
import { Field, FormError, SubmitButton } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { ColorSwatch } from '@/components/shared/primitives';
import { TranslationsTabs } from '@/components/shared/translations-tabs';
import { cleanTranslations } from '@/lib/i18n';
import { useColors, useDeleteColor, useSaveColor } from '@/lib/queries/catalog';
import { colorSchema, type ColorFormValues } from '@/lib/schemas/catalog';
import type { Color } from '@/lib/types';

function HexInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const valid = /^#[0-9A-Fa-f]{6}$/.test(value);
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} className="size-8 cursor-pointer rounded-md border p-0.5" aria-label="Renk seçici" />
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="#A3121B" className="w-32 font-mono uppercase" maxLength={7} />
      {valid && <ColorSwatch hex={value} size="lg" />}
    </div>
  );
}

function ColorDialog({ open, onOpenChange, color }: { open: boolean; onOpenChange: (o: boolean) => void; color: Color | null }) {
  const save = useSaveColor();
  const form = useForm<ColorFormValues>({
    resolver: zodResolver(colorSchema),
    defaultValues: {
      name: color?.name ?? '',
      slug: color?.slug ?? '',
      hex: color?.hex ?? '#1A1A1A',
      hex2: color?.hex2 ?? '',
      sortOrder: color?.sortOrder != null ? String(color.sortOrder) : '',
      translations: (color?.translations as Record<string, Record<string, string>>) ?? {},
    },
  });
  const onSubmit = form.handleSubmit(async (raw) => {
    const v = colorSchema.parse(raw);
    await save.mutateAsync({ id: color?.id, body: { name: v.name, slug: v.slug || undefined, hex: v.hex.toUpperCase(), hex2: v.hex2 ? v.hex2.toUpperCase() : null, sortOrder: v.sortOrder, translations: cleanTranslations(v.translations) ?? {} } });
    onOpenChange(false);
  });
  const hex = form.watch('hex');
  const hex2 = form.watch('hex2');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{color ? 'Rengi düzenle' : 'Yeni renk'}</DialogTitle>
          <DialogDescription>Varyantlarda ve görsel atamalarında kullanılır. İki renkli ürünler için ikinci ton ekleyin.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError error={save.error} />
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <ColorSwatch hex={/^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#000'} hex2={hex2 && /^#[0-9A-Fa-f]{6}$/.test(hex2) ? hex2 : null} size="lg" className="size-10" />
            <div className="text-sm">
              <p className="font-medium">{form.watch('name') || 'Renk adı'}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {hex}
                {hex2 ? ` / ${hex2}` : ''}
              </p>
            </div>
          </div>
          <TranslationsTabs
            form={form}
            fields={[{ name: 'name', label: 'Ad', required: true, maxLength: 40 }]}
            extraBase={
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ana renk" error={form.formState.errors.hex} htmlFor="hex" required>
                  <Controller control={form.control} name="hex" render={({ field }) => <HexInput id="hex" value={field.value} onChange={field.onChange} />} />
                </Field>
                <Field label="İkinci renk (opsiyonel)" error={form.formState.errors.hex2} htmlFor="hex2" hint="İki renkli ürünler için">
                  <Controller
                    control={form.control}
                    name="hex2"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <HexInput id="hex2" value={field.value ?? ''} onChange={field.onChange} />
                        {field.value && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange('')}>
                            Kaldır
                          </Button>
                        )}
                      </div>
                    )}
                  />
                </Field>
                <Field label="Slug" error={form.formState.errors.slug} htmlFor="color-slug" hint="SKU’da kullanılır; boşsa addan üretilir">
                  <Input id="color-slug" className="font-mono text-xs" {...form.register('slug')} />
                </Field>
                <Field label="Sıra" error={form.formState.errors.sortOrder} htmlFor="color-sort">
                  <Input id="color-sort" type="number" step={1} {...form.register('sortOrder')} />
                </Field>
              </div>
            }
          />
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

export default function ColorsPage() {
  const query = useColors();
  const del = useDeleteColor();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Color | null | undefined>(undefined);

  const columns: Column<Color>[] = [
    {
      key: 'name',
      header: 'Renk',
      cell: (c) => (
        <div className="flex items-center gap-3">
          <ColorSwatch hex={c.hex} hex2={c.hex2} size="lg" />
          <div>
            <p className="font-medium">{c.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {c.slug} · {c.hex}
              {c.hex2 ? ` / ${c.hex2}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'count', header: 'Varyant', align: 'right', cell: (c) => <span className="tabular-nums">{c._count?.variants ?? 0}</span> },
    { key: 'sort', header: 'Sıra', align: 'right', cell: (c) => <span className="tabular-nums text-muted-foreground">{c.sortOrder}</span> },
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
            onClick={() => confirm.ask({ title: `"${c.name}" silinsin mi?`, description: 'Varyantlarda kullanılan renkler silinemez.', confirmLabel: 'Sil', destructive: true, onConfirm: () => del.mutateAsync(c.id) })}
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
        title="Renkler"
        description={query.data ? `${query.data.length} renk` : undefined}
        actions={
          <Button onClick={() => setEditing(null)}>
            <PlusIcon /> Yeni renk
          </Button>
        }
      />
      <DataTable columns={columns} rows={query.data} rowKey={(c) => c.id} isLoading={query.isPending} error={query.error} onRetry={() => query.refetch()} emptyTitle="Renk yok" emptyDescription="Varyant oluşturmak için önce renk ekleyin." />
      {editing !== undefined && <ColorDialog open onOpenChange={(o) => !o && setEditing(undefined)} color={editing} />}
      {confirm.dialog}
    </>
  );
}
