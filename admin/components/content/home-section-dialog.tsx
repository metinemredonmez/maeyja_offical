'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FormError, SimpleSelect, SubmitButton, SwitchField } from '@/components/shared/form';
import { ImageUrlField } from '@/components/shared/media-picker';
import { ProductPicker } from '@/components/shared/pickers';
import { TranslationsTabs } from '@/components/shared/translations-tabs';
import { cleanTranslations } from '@/lib/i18n';
import { HOME_SECTION_TYPE } from '@/lib/labels';
import { useCollections } from '@/lib/queries/catalog';
import { useSaveHomeSection } from '@/lib/queries/content';
import { homeSectionSchema, type HomeSectionFormValues } from '@/lib/schemas/content';
import type { HomeSection, HomeSectionType } from '@/lib/types';

const HAS_MEDIA: HomeSectionType[] = ['HERO', 'EDITORIAL', 'CRAFT_STORY', 'COLLECTION'];
const HAS_VIDEO: HomeSectionType[] = ['HERO'];
const HAS_BODY: HomeSectionType[] = ['EDITORIAL', 'CRAFT_STORY', 'HERO'];
const HAS_CTA: HomeSectionType[] = ['HERO', 'EDITORIAL', 'CRAFT_STORY', 'COLLECTION', 'FEATURED_PRODUCTS'];

export function HomeSectionDialog({ section, type, onClose }: { section: HomeSection | null; type: HomeSectionType; onClose: () => void }) {
  const save = useSaveHomeSection();
  const collections = useCollections();
  const form = useForm<HomeSectionFormValues>({
    resolver: zodResolver(homeSectionSchema),
    defaultValues: {
      type,
      title: section?.title ?? '',
      subtitle: section?.subtitle ?? '',
      body: section?.body ?? '',
      imageUrl: section?.imageUrl ?? '',
      mobileImageUrl: section?.mobileImageUrl ?? '',
      videoUrl: section?.videoUrl ?? '',
      ctaLabel: section?.ctaLabel ?? '',
      ctaUrl: section?.ctaUrl ?? '',
      productIds: section?.payload?.productIds ?? [],
      collectionSlug: section?.payload?.collectionSlug ?? '',
      limit: section?.payload?.limit != null ? String(section.payload.limit) : '',
      isActive: section?.isActive ?? true,
      translations: (section?.translations as Record<string, Record<string, string>>) ?? {},
    },
  });

  const onSubmit = form.handleSubmit(async (raw) => {
    const v = homeSectionSchema.parse(raw);
    const nul = <T,>(x: T | undefined) => x ?? (section ? null : undefined);
    const payload: Record<string, unknown> = {};
    if (type === 'FEATURED_PRODUCTS') {
      if (v.productIds.length) payload.productIds = v.productIds;
      if (v.limit) payload.limit = v.limit;
    }
    if (type === 'COLLECTION') {
      if (v.collectionSlug) payload.collectionSlug = v.collectionSlug;
      if (v.limit) payload.limit = v.limit;
    }
    await save.mutateAsync({
      id: section?.id,
      body: {
        type,
        title: nul(v.title) as string | undefined,
        subtitle: nul(v.subtitle) as string | undefined,
        body: nul(HAS_BODY.includes(type) ? v.body : undefined) as string | undefined,
        imageUrl: nul(HAS_MEDIA.includes(type) ? v.imageUrl : undefined) as string | undefined,
        mobileImageUrl: nul(HAS_MEDIA.includes(type) ? v.mobileImageUrl : undefined) as string | undefined,
        videoUrl: nul(HAS_VIDEO.includes(type) ? v.videoUrl : undefined) as string | undefined,
        ctaLabel: nul(HAS_CTA.includes(type) ? v.ctaLabel : undefined) as string | undefined,
        ctaUrl: nul(HAS_CTA.includes(type) ? v.ctaUrl : undefined) as string | undefined,
        payload,
        isActive: v.isActive,
        translations: cleanTranslations(v.translations) ?? {},
      } as Partial<HomeSection> & { type: HomeSectionType },
    });
    onClose();
  });

  const meta = HOME_SECTION_TYPE[type];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {section ? 'Bölümü düzenle' : 'Yeni bölüm'} · {meta.label}
          </DialogTitle>
          <DialogDescription>{meta.hint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError error={save.error} />
          <TranslationsTabs
            form={form}
            fields={[
              { name: 'title', label: 'Başlık', maxLength: 160 },
              { name: 'subtitle', label: 'Alt başlık', type: 'textarea', rows: 2, maxLength: 300 },
              ...(HAS_BODY.includes(type) ? [{ name: 'body', label: 'Metin', type: 'rich' as const, rows: 6 }] : []),
              ...(HAS_CTA.includes(type) ? [{ name: 'ctaLabel', label: 'Buton metni', maxLength: 60 }] : []),
            ]}
            extraBase={
              <div className="grid gap-4">
                {HAS_CTA.includes(type) && (
                  <Field label="Buton adresi" error={form.formState.errors.ctaUrl} htmlFor="ctaUrl" hint="/collections/signature veya https://…">
                    <Input id="ctaUrl" maxLength={300} {...form.register('ctaUrl')} />
                  </Field>
                )}
                {HAS_MEDIA.includes(type) && (
                  <>
                    <Field label="Görsel" error={form.formState.errors.imageUrl}>
                      <Controller control={form.control} name="imageUrl" render={({ field }) => <ImageUrlField value={field.value} onChange={field.onChange} />} />
                    </Field>
                    <Field label="Mobil görsel (opsiyonel)" error={form.formState.errors.mobileImageUrl}>
                      <Controller control={form.control} name="mobileImageUrl" render={({ field }) => <ImageUrlField value={field.value} onChange={field.onChange} />} />
                    </Field>
                  </>
                )}
                {HAS_VIDEO.includes(type) && (
                  <Field label="Video (MP4/WebM, opsiyonel)" error={form.formState.errors.videoUrl}>
                    <Controller control={form.control} name="videoUrl" render={({ field }) => <ImageUrlField value={field.value} onChange={field.onChange} allowVideo placeholder="https://…/hero.mp4" />} />
                  </Field>
                )}
                {type === 'FEATURED_PRODUCTS' && (
                  <>
                    <Field label="Ürünler" hint="Boşsa öne çıkan ürünler otomatik gelir">
                      <Controller control={form.control} name="productIds" render={({ field }) => <ProductPicker value={field.value} onChange={field.onChange} max={24} />} />
                    </Field>
                    <Field label="Adet (otomatik seçimde)" error={form.formState.errors.limit} htmlFor="limit">
                      <Input id="limit" type="number" min={1} max={24} className="w-24" {...form.register('limit')} />
                    </Field>
                  </>
                )}
                {type === 'COLLECTION' && (
                  <>
                    <Field label="Koleksiyon" error={form.formState.errors.collectionSlug} htmlFor="collectionSlug" required>
                      <Controller control={form.control} name="collectionSlug" render={({ field }) => <SimpleSelect id="collectionSlug" value={field.value ?? ''} onChange={field.onChange} options={(collections.data ?? []).map((c) => ({ value: c.slug, label: c.name }))} placeholder="Koleksiyon seçin" />} />
                    </Field>
                    <Field label="Adet" error={form.formState.errors.limit} htmlFor="limit">
                      <Input id="limit" type="number" min={1} max={24} className="w-24" {...form.register('limit')} />
                    </Field>
                  </>
                )}
                <Controller control={form.control} name="isActive" render={({ field }) => <SwitchField label="Yayında" description="Pasif bölümler sitede görünmez" checked={field.value} onCheckedChange={field.onChange} />} />
              </div>
            }
          />
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
