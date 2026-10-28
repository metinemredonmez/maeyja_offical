'use client';

import { useState } from 'react';
import { Controller, type FieldErrors, type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/shared/form';
import { RichText } from '@/components/shared/rich-text';
import { DEFAULT_LOCALE, LOCALE_LABELS, LOCALES, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type TranslatableField = {
  name: string;
  label: string;
  type?: 'input' | 'textarea' | 'rich';
  required?: boolean;
  hint?: string;
  rows?: number;
  maxLength?: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Props = {
  form: UseFormReturn<any>;
  fields: TranslatableField[];
  className?: string;
  /** Rendered inside the TR tab only, after the translatable fields (e.g. slug). */
  extraBase?: React.ReactNode;
};

/**
 * One tab per locale. The TR tab edits base fields; other tabs edit
 * `translations[lang][field]`. Empty translated fields fall back to Turkish.
 */
export function TranslationsTabs({ form, fields, className, extraBase }: Props) {
  const [lang, setLang] = useState<Locale>(DEFAULT_LOCALE);
  const translations = form.watch('translations') as Record<string, Record<string, string>> | undefined;
  const errors = form.formState.errors as FieldErrors<Record<string, unknown>>;

  const filled = (l: Locale) => {
    if (l === DEFAULT_LOCALE) return fields.filter((f) => Boolean(form.getValues(f.name))).length;
    const t = translations?.[l] ?? {};
    return fields.filter((f) => Boolean(t[f.name]?.trim())).length;
  };

  const path = (l: Locale, name: string) => (l === DEFAULT_LOCALE ? name : `translations.${l}.${name}`);

  const renderField = (l: Locale, f: TranslatableField) => {
    const name = path(l, f.name);
    const id = `${name}`.replace(/\./g, '-');
    const base = l === DEFAULT_LOCALE;
    const error = base ? (errors[f.name] as { message?: string } | undefined) : undefined;
    const placeholder = base ? undefined : `Boş bırakılırsa Türkçe metin kullanılır`;
    if (f.type === 'rich') {
      return (
        <Field key={name} label={f.label} required={base && f.required} error={error} hint={f.hint} htmlFor={id}>
          <Controller control={form.control} name={name} render={({ field }) => <RichText id={id} value={(field.value as string) ?? ''} onChange={field.onChange} rows={f.rows ?? 10} placeholder={placeholder} />} />
        </Field>
      );
    }
    if (f.type === 'textarea') {
      return (
        <Field key={name} label={f.label} required={base && f.required} error={error} hint={f.hint} htmlFor={id}>
          <Textarea id={id} rows={f.rows ?? 4} maxLength={f.maxLength} placeholder={placeholder} {...form.register(name)} />
        </Field>
      );
    }
    return (
      <Field key={name} label={f.label} required={base && f.required} error={error} hint={f.hint} htmlFor={id}>
        <Input id={id} maxLength={f.maxLength} placeholder={placeholder} {...form.register(name)} />
      </Field>
    );
  };

  return (
    <Tabs value={lang} onValueChange={(v) => setLang(v as Locale)} className={cn('gap-4', className)}>
      <TabsList variant="line" className="!h-auto w-full flex-wrap justify-start gap-x-0.5 gap-y-1 border-b pb-1">
        {LOCALES.map((l) => {
          const n = filled(l);
          return (
            <TabsTrigger key={l} value={l} className="!h-8 flex-none gap-1.5 px-2 text-xs">
              <span className="uppercase tracking-wide">{l}</span>
              <span className="hidden text-muted-foreground sm:inline">{LOCALE_LABELS[l]}</span>
              {n > 0 && <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', l === DEFAULT_LOCALE ? 'bg-foreground/10' : 'bg-emerald-100 text-emerald-800')}>{n}</span>}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {LOCALES.map((l) => (
        <TabsContent key={l} value={l} className="grid gap-4" keepMounted>
          {l !== DEFAULT_LOCALE && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {LOCALE_LABELS[l]} çevirisi. Boş bırakılan alanlar sitede Türkçe metne düşer.
            </p>
          )}
          {fields.map((f) => renderField(l, f))}
          {l === DEFAULT_LOCALE && extraBase}
        </TabsContent>
      ))}
    </Tabs>
  );
}
