'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangleIcon, UsersIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Field, FormError, SimpleSelect, SubmitButton } from '@/components/shared/form';
import { Section } from '@/components/shared/primitives';
import { RichText } from '@/components/shared/rich-text';
import { LOCALE_LABELS, LOCALES } from '@/lib/i18n';
import { CAMPAIGN_AUDIENCE } from '@/lib/labels';
import { useCampaignAudience, type CampaignInput } from '@/lib/queries/marketing';
import { campaignSchema, type CampaignFormValues } from '@/lib/schemas/marketing';
import type { CampaignAudience, EmailCampaign } from '@/lib/types';

/** Warns when SMTP isn't set up: drafts can be written, nothing can be sent. */
export function MailDisabledNotice() {
  return (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">E-posta gönderimi ayarlı değil</p>
        <p className="text-xs">Taslak hazırlayabilirsiniz. Göndermek için sunucuda backend/.env içindeki SMTP_* alanları (Resend) doldurulmalı.</p>
      </div>
    </div>
  );
}

export function CampaignForm({
  campaign,
  onSubmit,
  submitting,
  error,
  aside,
}: {
  campaign?: EmailCampaign;
  onSubmit: (body: CampaignInput) => Promise<unknown>;
  submitting?: boolean;
  error?: unknown;
  /** Extra panels under the audience box (test / send actions on the edit page). */
  aside?: React.ReactNode;
}) {
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      subject: campaign?.subject ?? '',
      preheader: campaign?.preheader ?? '',
      title: campaign?.title ?? '',
      body: campaign?.body ?? '',
      ctaLabel: campaign?.ctaLabel ?? '',
      ctaUrl: campaign?.ctaUrl ?? '',
      audience: campaign?.audience ?? 'ALL',
      locale: campaign?.locale ?? '',
    },
  });
  const audience = form.watch('audience') as CampaignAudience;
  const locale = form.watch('locale') || null;
  const count = useCampaignAudience({ audience, locale });
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (raw) => {
    const v = campaignSchema.parse(raw);
    await onSubmit({
      subject: v.subject,
      preheader: v.preheader ?? null,
      title: v.title ?? null,
      body: v.body,
      ctaLabel: v.ctaLabel ?? null,
      ctaUrl: v.ctaUrl ?? null,
      audience: v.audience,
      locale: v.locale || null,
    });
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <FormError error={error} />
        <Section title="E-posta" description="Tek dilde yazılır; dil seçimiyle yalnızca o dildeki kişilere gönderebilirsiniz.">
          <div className="grid gap-4">
            <Field label="Konu" error={errors.subject} htmlFor="subject" required hint={`${form.watch('subject').length}/150`}>
              <Input id="subject" maxLength={150} placeholder="Yeni sezon: Origami artık siyahta" {...form.register('subject')} />
            </Field>
            <Field label="Önizleme satırı" error={errors.preheader} htmlFor="preheader" hint="Gelen kutusunda konunun yanında görünen kısa metin">
              <Input id="preheader" maxLength={200} {...form.register('preheader')} />
            </Field>
            <Field label="Başlık" error={errors.title} htmlFor="title" hint="E-postanın içindeki büyük başlık (opsiyonel)">
              <Input id="title" maxLength={160} {...form.register('title')} />
            </Field>
            <Field label="İçerik" error={errors.body} htmlFor="body" required>
              <Controller control={form.control} name="body" render={({ field }) => <RichText id="body" value={field.value ?? ''} onChange={field.onChange} rows={14} placeholder="<p>Merhaba,</p>" />} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Buton metni" error={errors.ctaLabel} htmlFor="ctaLabel">
                <Input id="ctaLabel" maxLength={60} placeholder="Koleksiyonu keşfet" {...form.register('ctaLabel')} />
              </Field>
              <Field label="Buton bağlantısı" error={errors.ctaUrl} htmlFor="ctaUrl" hint="/products/origami veya https://…">
                <Input id="ctaUrl" maxLength={500} placeholder="/products" {...form.register('ctaUrl')} />
              </Field>
            </div>
          </div>
        </Section>
      </div>

      <div className="space-y-5">
        <Section title="Hedef kitle">
          <div className="grid gap-4">
            <Field label="Kime" htmlFor="audience" required>
              <Controller
                control={form.control}
                name="audience"
                render={({ field }) => (
                  <SimpleSelect id="audience" value={field.value} onChange={field.onChange} options={Object.entries(CAMPAIGN_AUDIENCE).map(([value, label]) => ({ value, label }))} />
                )}
              />
            </Field>
            <Field label="Dil" htmlFor="locale">
              <Controller
                control={form.control}
                name="locale"
                render={({ field }) => (
                  <SimpleSelect id="locale" value={field.value} onChange={field.onChange} allowEmpty emptyLabel="Tüm diller" options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))} />
                )}
              />
            </Field>
            <p className="flex items-center gap-2 text-sm">
              <UsersIcon className="size-4 text-muted-foreground" />
              {count.data ? <span><b className="tabular-nums">{count.data.count}</b> kişiye gidecek</span> : <span className="text-muted-foreground">Hesaplanıyor…</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              Yalnızca pazarlama izni vermiş kişilere gider; abonelikten çıkanlar otomatik hariç tutulur. Her e-postada abonelikten çıkma bağlantısı bulunur. Türkiye’de ticari ileti için İYS kaydı gerekir.
            </p>
            <SubmitButton loading={submitting}>Taslağı kaydet</SubmitButton>
          </div>
        </Section>
        {aside}
      </div>
    </form>
  );
}
