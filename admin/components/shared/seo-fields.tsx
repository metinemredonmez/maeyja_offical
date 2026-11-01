'use client';

import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/shared/form';

type SeoShape = { seoTitle?: string; seoDescription?: string; aiSummary?: string };

/**
 * SEO for search engines, and a separate note for AI assistants (ChatGPT, Claude, Gemini, Perplexity): the shop's
 * llms.txt and the page's structured data carry it, translated into every language like the rest.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function SeoFields({ register, errors, watch }: { register: UseFormRegister<any>; errors: FieldErrors<SeoShape>; watch?: (name: 'seoTitle' | 'seoDescription' | 'aiSummary') => string | undefined }) {
  const title = watch?.('seoTitle') ?? '';
  const desc = watch?.('seoDescription') ?? '';
  const ai = watch?.('aiSummary') ?? '';
  return (
    <div className="grid gap-4">
      <Field label="SEO başlığı" error={errors.seoTitle} hint={`${title.length}/160 · Boşsa ad kullanılır`} htmlFor="seoTitle">
        <Input id="seoTitle" maxLength={160} {...register('seoTitle')} />
      </Field>
      <Field label="SEO açıklaması" error={errors.seoDescription} hint={`${desc.length}/320`} htmlFor="seoDescription">
        <Textarea id="seoDescription" rows={3} maxLength={320} {...register('seoDescription')} />
      </Field>
      <div className="grid gap-1.5 border-t pt-4">
        <p className="text-sm font-medium">Yapay zekâ asistanları için</p>
        <p className="text-xs text-muted-foreground">
          ChatGPT, Claude, Gemini, Perplexity gibi asistanlar biri MAEYJA hakkında sorduğunda bunu okur (sitenin llms.txt dosyası ve sayfanın yapılandırılmış
          verisi). Reklam dili değil, net bilgi yazın: ne olduğu, kimin için, malzeme, ölçü, fiyat, nereden alınır. Türkçe yazın; diğer dillere kendiliğinden
          çevrilir.
        </p>
      </div>
      <Field label="Asistanlara özet" error={errors.aiSummary} hint={`${ai.length}/1200 · Boşsa SEO açıklaması kullanılır`} htmlFor="aiSummary">
        <Textarea id="aiSummary" rows={4} maxLength={1200} placeholder="Ör. Petal Box: tek parça dana derisinden katlanarak dikilen küçük kutu çanta; 16 × 12,5 × 16 cm; kısa sapı ve çıkarılabilir askısı var; İstanbul'da elde üretilir; 20.000 TL." {...register('aiSummary')} />
      </Field>
    </div>
  );
}
