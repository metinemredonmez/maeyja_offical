'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Field, FormError, SimpleSelect, SubmitButton, SwitchField } from '@/components/shared/form';
import { Section } from '@/components/shared/primitives';
import { SeoFields } from '@/components/shared/seo-fields';
import { TranslationsTabs } from '@/components/shared/translations-tabs';
import { ImagesEditor, type LocalImage } from '@/components/products/images-editor';
import { VariantsEditor, type LocalVariant } from '@/components/products/variants-editor';
import { useCategories, useCollections, useColors, type ProductInput } from '@/lib/queries/catalog';
import { cleanTranslations } from '@/lib/i18n';
import { PRODUCT_STATUS } from '@/lib/labels';
import { slugify } from '@/lib/format';
import { productSchema, type ProductFormOutput, type ProductFormValues } from '@/lib/schemas/catalog';
import type { Product, ProductStatus } from '@/lib/types';

type Props = {
  product?: Product;
  onSubmit: (body: ProductInput) => Promise<unknown>;
  submitting?: boolean;
  error?: unknown;
};

const nullable = (v: string | undefined) => (v === undefined ? null : v);

/** Drops the local-only `_key` used for React list identity before sending to the API. */
function omitKey<T extends { _key: string }>(x: T): Omit<T, '_key'> {
  const copy: Record<string, unknown> = { ...x };
  delete copy._key;
  return copy as Omit<T, '_key'>;
}

function toDefaults(p?: Product): ProductFormValues {
  return {
    name: p?.name ?? '',
    slug: p?.slug ?? '',
    subtitle: p?.subtitle ?? '',
    description: p?.description ?? '',
    story: p?.story ?? '',
    material: p?.material ?? '',
    care: p?.care ?? '',
    dimensions: p?.dimensions ?? '',
    madeIn: p?.madeIn ?? 'Türkiye',
    sizeGuide: p?.sizeGuide ?? '',
    status: p?.status ?? 'DRAFT',
    isFeatured: p?.isFeatured ?? false,
    basePrice: p ? String(p.basePrice) : '',
    compareAtPrice: p?.compareAtPrice != null ? String(p.compareAtPrice) : '',
    taxRate: p?.taxRate != null ? String(p.taxRate) : '',
    categoryId: p?.categoryId ?? '',
    collectionIds: p?.collectionIds ?? [],
    tags: p?.tags?.join(', ') ?? '',
    translations: (p?.translations as Record<string, Record<string, string>> | null) ?? {},
    seoTitle: p?.seoTitle ?? '',
    seoDescription: p?.seoDescription ?? '',
  };
}

export function toProductPayload(v: ProductFormOutput, editing: boolean): ProductInput {
  const text = (s: string | undefined) => (editing ? nullable(s) : s);
  return {
    name: v.name,
    slug: v.slug || undefined,
    subtitle: text(v.subtitle) as string | undefined,
    description: text(v.description) as string | undefined,
    story: text(v.story) as string | undefined,
    material: text(v.material) as string | undefined,
    care: text(v.care) as string | undefined,
    dimensions: text(v.dimensions) as string | undefined,
    madeIn: text(v.madeIn) as string | undefined,
    sizeGuide: text(v.sizeGuide) as string | undefined,
    status: v.status,
    isFeatured: v.isFeatured,
    basePrice: v.basePrice,
    compareAtPrice: v.compareAtPrice ?? null,
    taxRate: v.taxRate ?? null,
    categoryId: v.categoryId || null,
    collectionIds: v.collectionIds,
    tags: (v.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    translations: cleanTranslations(v.translations) ?? {},
    seoTitle: text(v.seoTitle) as string | undefined,
    seoDescription: text(v.seoDescription) as string | undefined,
  };
}

export function ProductForm({ product, onSubmit, submitting, error }: Props) {
  const editing = Boolean(product);
  const form = useForm<ProductFormValues, unknown, ProductFormOutput>({ resolver: zodResolver(productSchema), defaultValues: toDefaults(product) });
  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const categories = useCategories();
  const collections = useCollections();
  const colors = useColors();
  const [variants, setVariants] = useState<LocalVariant[]>([]);
  const [images, setImages] = useState<LocalImage[]>([]);
  const [variantError, setVariantError] = useState<string | null>(null);

  const name = watch('name');
  const slug = watch('slug');
  const slugTouched = formState.dirtyFields.slug;
  useEffect(() => {
    if (!editing && !slugTouched) setValue('slug', slugify(name ?? ''));
  }, [name, editing, slugTouched, setValue]);

  const submit = handleSubmit(async (values) => {
    setVariantError(null);
    const body = toProductPayload(values, editing);
    if (!editing) {
      if (variants.length === 0) {
        setVariantError('En az bir varyant (renk/beden) gerekli');
        return;
      }
      const combos = variants.map((v) => `${v.colorId ?? '-'}|${v.size ?? '-'}`);
      if (new Set(combos).size !== combos.length) {
        setVariantError('Aynı renk/beden kombinasyonu iki kez girilmiş');
        return;
      }
      body.variants = variants.map((v, i) => ({ ...omitKey(v), sortOrder: i }));
      body.images = images.map((img, i) => ({ ...omitKey(img), sortOrder: i }));
    }
    await onSubmit(body);
  });

  const statusOptions = (Object.keys(PRODUCT_STATUS) as ProductStatus[]).map((s) => ({ value: s, label: PRODUCT_STATUS[s].label }));

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-5">
        <FormError error={error} />
        <Section title="Ürün bilgileri" description="TR sekmesi temel metinlerdir; diğer diller boş bırakılırsa Türkçe gösterilir.">
          <TranslationsTabs kind="product page"
            form={form}
            fields={[
              { name: 'name', label: 'Ürün adı', required: true, maxLength: 120 },
              { name: 'subtitle', label: 'Alt başlık', maxLength: 160 },
              { name: 'description', label: 'Açıklama', type: 'rich', rows: 8 },
              { name: 'story', label: 'Hikâye (zanaat anlatısı)', type: 'rich', rows: 6 },
              { name: 'material', label: 'Malzeme', maxLength: 200 },
              { name: 'care', label: 'Bakım', type: 'textarea', rows: 3 },
              { name: 'madeIn', label: 'Üretim yeri', maxLength: 60 },
              { name: 'sizeGuide', label: 'Ölçü rehberi', type: 'rich', rows: 5 },
            ]}
            extraBase={
              <Field label="Boyutlar" error={formState.errors.dimensions} htmlFor="dimensions" hint="Örn. 32 × 24 × 12 cm">
                <Input id="dimensions" maxLength={200} {...register('dimensions')} />
              </Field>
            }
          />
        </Section>

        <Section title="Varyantlar" description="Renk × beden kombinasyonları ve stok.">
          {variantError && <p className="mb-2 text-xs text-rose-700">{variantError}</p>}
          {editing && product ? (
            <VariantsEditor mode="remote" productId={product.id} variants={product.variants} colors={colors.data ?? []} productSlug={product.slug} />
          ) : (
            <VariantsEditor mode="local" value={variants} onChange={setVariants} colors={colors.data ?? []} productSlug={slug || slugify(name ?? '')} />
          )}
        </Section>

        <Section title="Görseller">
          {editing && product ? <ImagesEditor mode="remote" productId={product.id} images={product.images} colors={colors.data ?? []} /> : <ImagesEditor mode="local" value={images} onChange={setImages} colors={colors.data ?? []} />}
        </Section>

        <Section title="SEO">
          <SeoFields register={register} errors={formState.errors} watch={(n) => watch(n)} />
        </Section>
      </div>

      <aside className="space-y-5">
        <Section title="Yayın">
          <div className="grid gap-4">
            <Field label="Durum" error={formState.errors.status} htmlFor="status">
              <Controller control={control} name="status" render={({ field }) => <SimpleSelect id="status" value={field.value} onChange={field.onChange} options={statusOptions} />} />
            </Field>
            <Controller control={control} name="isFeatured" render={({ field }) => <SwitchField label="Öne çıkan" description="Ana sayfa ve vitrinde öncelikli" checked={field.value} onCheckedChange={field.onChange} />} />
            <Field label="Slug" error={formState.errors.slug} htmlFor="slug" hint="/products/… adresi">
              <Input id="slug" {...register('slug')} className="font-mono text-xs" />
            </Field>
            <Field label="Kategori" error={formState.errors.categoryId} htmlFor="categoryId">
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => <SimpleSelect id="categoryId" value={field.value ?? ''} onChange={field.onChange} allowEmpty emptyLabel="Kategori yok" options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />}
              />
            </Field>
            <Field label="Koleksiyonlar">
              <Controller
                control={control}
                name="collectionIds"
                render={({ field }) => (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                    {(collections.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">Koleksiyon yok</p>}
                    {(collections.data ?? []).map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                        <Checkbox checked={field.value.includes(c.id)} onCheckedChange={(v) => field.onChange(v ? [...field.value, c.id] : field.value.filter((x: string) => x !== c.id))} />
                        {c.name}
                      </label>
                    ))}
                  </div>
                )}
              />
            </Field>
            <Field label="Etiketler" error={formState.errors.tags} htmlFor="tags" hint="Virgülle ayırın">
              <Input id="tags" placeholder="deri, el yapımı" {...register('tags')} />
            </Field>
          </div>
        </Section>

        <Section title="Fiyat" description="Fiyatlar KDV dahildir.">
          <div className="grid gap-4">
            <Field label="Fiyat (₺)" error={formState.errors.basePrice} htmlFor="basePrice" required>
              <Input id="basePrice" type="number" min={0} step="0.01" inputMode="decimal" {...register('basePrice')} />
            </Field>
            <Field label="Eski fiyat (₺)" error={formState.errors.compareAtPrice} htmlFor="compareAtPrice" hint="İndirim göstermek için">
              <Input id="compareAtPrice" type="number" min={0} step="0.01" inputMode="decimal" {...register('compareAtPrice')} />
            </Field>
            <Field label="KDV oranı (%)" error={formState.errors.taxRate} htmlFor="taxRate" hint="Boşsa ayarlardaki varsayılan">
              <Input id="taxRate" type="number" min={0} max={100} step={1} {...register('taxRate')} />
            </Field>
          </div>
        </Section>

        <div className="sticky bottom-4 flex gap-2">
          <SubmitButton loading={submitting} className="flex-1">
            {editing ? 'Değişiklikleri kaydet' : 'Ürünü oluştur'}
          </SubmitButton>
        </div>
      </aside>
    </form>
  );
}
