'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Field, FormError, SimpleSelect, SubmitButton } from '@/components/shared/form';
import { Section } from '@/components/shared/primitives';
import { SeoFields } from '@/components/shared/seo-fields';
import { TranslationsTabs } from '@/components/shared/translations-tabs';
import { cleanTranslations } from '@/lib/i18n';
import { CONTENT_STATUS } from '@/lib/labels';
import type { PageInput } from '@/lib/queries/content';
import { pageSchema, type PageFormValues } from '@/lib/schemas/content';
import type { ContentStatus, Page } from '@/lib/types';

const KNOWN_SLUGS = ['about', 'expertise', 'shipping-returns', 'care', 'privacy', 'kvkk', 'terms', 'distance-sales-agreement', 'preliminary-information'];

export function PageForm({ page, onSubmit, submitting, error }: { page?: Page; onSubmit: (body: Partial<PageInput>) => Promise<unknown>; submitting?: boolean; error?: unknown }) {
  const form = useForm<PageFormValues>({
    resolver: zodResolver(pageSchema),
    defaultValues: {
      slug: page?.slug ?? '',
      title: page?.title ?? '',
      body: page?.body ?? '',
      status: page?.status ?? 'PUBLISHED',
      translations: (page?.translations as Record<string, Record<string, string>>) ?? {},
      seoTitle: page?.seoTitle ?? '',
      seoDescription: page?.seoDescription ?? '',
    },
  });
  const submit = form.handleSubmit(async (raw) => {
    const v = pageSchema.parse(raw);
    await onSubmit({ slug: v.slug, title: v.title, body: v.body, status: v.status, translations: cleanTranslations(v.translations) ?? {}, seoTitle: v.seoTitle ?? (page ? (null as unknown as undefined) : undefined), seoDescription: v.seoDescription ?? (page ? (null as unknown as undefined) : undefined) });
  });
  return (
    <form onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <FormError error={error} />
        <Section title="İçerik" description="HTML olarak saklanır; önizleme temizlenmiş çıktıyı gösterir.">
          <TranslationsTabs kind="store page"
            form={form}
            fields={[
              { name: 'title', label: 'Başlık', required: true, maxLength: 160 },
              { name: 'body', label: 'İçerik', type: 'rich', required: true, rows: 18 },
            ]}
          />
        </Section>
        <Section title="SEO">
          <SeoFields register={form.register} errors={form.formState.errors} watch={(n) => form.watch(n)} />
        </Section>
      </div>
      <aside className="space-y-5">
        <Section title="Yayın">
          <div className="grid gap-4">
            <Field label="Slug" error={form.formState.errors.slug} htmlFor="slug" required hint={`Sitedeki adres: maeyja.com/… · Bilinen: ${KNOWN_SLUGS.join(', ')}`}>
              <Input id="slug" className="font-mono text-xs" list="known-slugs" {...form.register('slug')} />
              <datalist id="known-slugs">
                {KNOWN_SLUGS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label="Durum" htmlFor="status">
              <Controller control={form.control} name="status" render={({ field }) => <SimpleSelect id="status" value={field.value} onChange={field.onChange} options={(Object.keys(CONTENT_STATUS) as ContentStatus[]).map((s) => ({ value: s, label: CONTENT_STATUS[s].label }))} />} />
            </Field>
          </div>
        </Section>
        <SubmitButton loading={submitting} className="w-full">
          {page ? 'Kaydet' : 'Sayfayı oluştur'}
        </SubmitButton>
      </aside>
    </form>
  );
}
