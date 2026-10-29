'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Field, FormError, SimpleSelect, SubmitButton } from '@/components/shared/form';
import { ImageUrlField } from '@/components/shared/media-picker';
import { Section } from '@/components/shared/primitives';
import { SeoFields } from '@/components/shared/seo-fields';
import { TranslationsTabs } from '@/components/shared/translations-tabs';
import { cleanTranslations } from '@/lib/i18n';
import { CONTENT_STATUS } from '@/lib/labels';
import { fromLocalInput, slugify, toLocalInput } from '@/lib/format';
import type { JournalInput } from '@/lib/queries/content';
import { journalSchema, type JournalFormValues } from '@/lib/schemas/content';
import type { ContentStatus, JournalPost } from '@/lib/types';

export function JournalForm({ post, onSubmit, submitting, error }: { post?: JournalPost; onSubmit: (body: Partial<JournalInput>) => Promise<unknown>; submitting?: boolean; error?: unknown }) {
  const editing = Boolean(post);
  const form = useForm<JournalFormValues>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      title: post?.title ?? '',
      slug: post?.slug ?? '',
      excerpt: post?.excerpt ?? '',
      body: post?.body ?? '',
      coverImageUrl: post?.coverImageUrl ?? '',
      status: post?.status ?? 'DRAFT',
      publishedAt: toLocalInput(post?.publishedAt),
      translations: (post?.translations as Record<string, Record<string, string>>) ?? {},
      seoTitle: post?.seoTitle ?? '',
      seoDescription: post?.seoDescription ?? '',
    },
  });
  const title = form.watch('title');
  const slugTouched = form.formState.dirtyFields.slug;
  useEffect(() => {
    if (!editing && !slugTouched) form.setValue('slug', slugify(title ?? ''));
  }, [title, editing, slugTouched, form]);

  const submit = form.handleSubmit(async (raw) => {
    const v = journalSchema.parse(raw);
    const nul = <T,>(x: T | undefined) => (x === undefined && editing ? null : x);
    await onSubmit({
      title: v.title,
      slug: v.slug || undefined,
      excerpt: nul(v.excerpt) as string | undefined,
      body: v.body,
      coverImageUrl: nul(v.coverImageUrl) as string | undefined,
      status: v.status,
      publishedAt: v.publishedAt ? fromLocalInput(v.publishedAt) : v.status === 'PUBLISHED' && !post?.publishedAt ? new Date().toISOString() : editing ? null : undefined,
      translations: cleanTranslations(v.translations) ?? {},
      seoTitle: nul(v.seoTitle) as string | undefined,
      seoDescription: nul(v.seoDescription) as string | undefined,
    });
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <FormError error={error} />
        <Section title="Yazı">
          <TranslationsTabs kind="journal article"
            form={form}
            fields={[
              { name: 'title', label: 'Başlık', required: true, maxLength: 160 },
              { name: 'excerpt', label: 'Özet', type: 'textarea', rows: 2, maxLength: 400, hint: 'Liste kartlarında görünür' },
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
            <Field label="Durum" htmlFor="status">
              <Controller control={form.control} name="status" render={({ field }) => <SimpleSelect id="status" value={field.value} onChange={field.onChange} options={(Object.keys(CONTENT_STATUS) as ContentStatus[]).map((s) => ({ value: s, label: CONTENT_STATUS[s].label }))} />} />
            </Field>
            <Field label="Yayın tarihi" error={form.formState.errors.publishedAt} htmlFor="publishedAt" hint="Boşsa yayına alınırken şimdi">
              <Input id="publishedAt" type="datetime-local" {...form.register('publishedAt')} />
            </Field>
            <Field label="Slug" error={form.formState.errors.slug} htmlFor="slug" hint="/journal/…">
              <Input id="slug" className="font-mono text-xs" {...form.register('slug')} />
            </Field>
          </div>
        </Section>
        <Section title="Kapak görseli">
          <Controller control={form.control} name="coverImageUrl" render={({ field }) => <ImageUrlField value={field.value} onChange={field.onChange} />} />
          {form.formState.errors.coverImageUrl && <p className="mt-1 text-xs text-rose-700">{form.formState.errors.coverImageUrl.message}</p>}
        </Section>
        <SubmitButton loading={submitting} className="w-full">
          {editing ? 'Kaydet' : 'Yazıyı oluştur'}
        </SubmitButton>
      </aside>
    </form>
  );
}
