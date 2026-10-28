'use client';

import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/shared/form';

type SeoShape = { seoTitle?: string; seoDescription?: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
export function SeoFields({ register, errors, watch }: { register: UseFormRegister<any>; errors: FieldErrors<SeoShape>; watch?: (name: 'seoTitle' | 'seoDescription') => string | undefined }) {
  const title = watch?.('seoTitle') ?? '';
  const desc = watch?.('seoDescription') ?? '';
  return (
    <div className="grid gap-4">
      <Field label="SEO başlığı" error={errors.seoTitle} hint={`${title.length}/160 · Boşsa ad kullanılır`} htmlFor="seoTitle">
        <Input id="seoTitle" maxLength={160} {...register('seoTitle')} />
      </Field>
      <Field label="SEO açıklaması" error={errors.seoDescription} hint={`${desc.length}/320`} htmlFor="seoDescription">
        <Textarea id="seoDescription" rows={3} maxLength={320} {...register('seoDescription')} />
      </Field>
    </div>
  );
}
