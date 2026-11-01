'use client';

import { useState } from 'react';
import { Controller, type FieldErrors, type UseFormReturn } from 'react-hook-form';
import { Languages, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/shared/form';
import { RichText } from '@/components/shared/rich-text';
import { api, errorMessage } from '@/lib/api.client';
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
  /** Tells the translator what it is translating ("ürün sayfası", "SSS"…). */
  kind?: string;
  /** Category forms: "AI ile doldur" also brings sub-category and product ideas and a tip. */
  onExtras?: (extras: DraftExtras) => void;
};

export type DraftExtras = { children?: { name: string; description: string }[]; products?: { name: string; subtitle: string; description: string }[]; tip?: string };
/** Fields "AI ile doldur" may draft; facts (material, size guide, measurements…) are left to the shop. */
const DRAFTABLE = ['subtitle', 'description', 'story', 'care', 'excerpt', 'body', 'answer', 'seoTitle', 'seoDescription', 'aiSummary'];

/**
 * One tab per locale. The TR tab edits base fields; other tabs edit
 * `translations[lang][field]`. Empty translated fields fall back to Turkish.
 */
export function TranslationsTabs({ form, fields, className, extraBase, kind, onExtras }: Props) {
  const [lang, setLang] = useState<Locale>(DEFAULT_LOCALE);
  const [translating, setTranslating] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const translations = form.watch('translations') as Record<string, Record<string, string>> | undefined;
  const errors = form.formState.errors as FieldErrors<Record<string, unknown>>;

  const filled = (l: Locale) => {
    if (l === DEFAULT_LOCALE) return fields.filter((f) => Boolean(form.getValues(f.name))).length;
    const t = translations?.[l] ?? {};
    return fields.filter((f) => Boolean(t[f.name]?.trim())).length;
  };

  const path = (l: Locale, name: string) => (l === DEFAULT_LOCALE ? name : `translations.${l}.${name}`);

  /**
   * Fills, from the Turkish text (Claude), every language field that is empty or out of date: its Turkish was changed
   * in this form while the translation was left as it was. Translations edited by hand here are kept. Nothing is
   * saved until the form is (and the server does the same on its own a minute after saving).
   */
  const autoTranslate = async () => {
    const initial = (form.formState.defaultValues ?? {}) as Record<string, unknown> & { translations?: Record<string, Record<string, string>> };
    const turkishChanged = (name: string) => String(initial[name] ?? '') !== String(form.getValues(name) ?? '');
    const needs = (l: Locale, name: string) => {
      const now = String(form.getValues(`translations.${l}.${name}`) ?? '');
      return !now.trim() || (turkishChanged(name) && now === String(initial.translations?.[l]?.[name] ?? ''));
    };
    const source = Object.fromEntries(fields.map((f) => [f.name, String(form.getValues(f.name) ?? '')]).filter(([, v]) => v.trim()));
    if (!Object.keys(source).length) {
      toast.error('Önce Türkçe metni yazın');
      return;
    }
    const targets = LOCALES.filter((l) => l !== DEFAULT_LOCALE && Object.keys(source).some((name) => needs(l, name)));
    const wanted = Object.fromEntries(Object.entries(source).filter(([name]) => targets.some((l) => needs(l, name))));
    if (!targets.length) {
      toast.success('Bütün diller güncel — Türkçeyi değiştirdiğinizde değişen alanlar yeniden çevrilir');
      return;
    }
    setTranslating(true);
    try {
      const { translations } = await api.post<{ translations: Record<string, Record<string, string>> }>('/admin/ai/translate', { fields: wanted, kind, targets });
      let count = 0;
      for (const [l, values] of Object.entries(translations)) {
        for (const [name, value] of Object.entries(values)) {
          if (!needs(l as Locale, name)) continue;
          form.setValue(`translations.${l}.${name}`, value, { shouldDirty: true });
          count++;
        }
      }
      toast.success(`${count} alan çevrildi — kaydetmeden önce göz atabilirsiniz`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTranslating(false);
    }
  };

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
    // A short field left empty shows its Turkish text (a product name is the same in every language).
    const turkish = base ? '' : String(form.watch(f.name) ?? '').trim();
    return (
      <Field key={name} label={f.label} required={base && f.required} error={error} hint={!base && turkish ? (f.hint ?? 'Boşsa Türkçesi kullanılır') : f.hint} htmlFor={id}>
        <Input id={id} maxLength={f.maxLength} placeholder={turkish || placeholder} {...form.register(name)} />
      </Field>
    );
  };

  /**
   * "AI ile doldur": from what is written in Turkish (at least the name), Claude drafts the empty Turkish fields and
   * the SEO texts, then every language is translated. Nothing is saved until the form is.
   */
  const aiFill = async () => {
    const values = form.getValues() as Record<string, unknown>;
    const text = (k: string) => (typeof values[k] === 'string' ? (values[k] as string) : '');
    const first = fields[0];
    if (!text(first.name).trim()) {
      toast.error(`Önce “${first.label}” alanını yazın`);
      return;
    }
    const known = new Set([...fields.map((f) => f.name), ...Object.keys(values)]);
    const want = DRAFTABLE.filter((k) => known.has(k) && !text(k).replace(/<[^>]*>/g, '').trim());
    if (!want.length && !onExtras) {
      toast.success('Boş alan yok — doldurulacak bir şey kalmadı');
      return;
    }
    // What is written, minus ids, addresses and the slug (no meaning for the writer).
    const given = Object.fromEntries([...known].map((k) => [k, text(k)]).filter(([k, v]) => k !== 'slug' && !/(Id|Ids|Url)$/.test(k) && v.trim()));
    const rich = fields.filter((f) => f.type === 'rich').map((f) => f.name);
    setDrafting(true);
    try {
      const res = await api.post<{ fields: Record<string, string> } & DraftExtras>('/admin/ai/draft', { kind: kind ?? 'store content', given, want, rich, extras: Boolean(onExtras) });
      for (const [k, v] of Object.entries(res.fields)) form.setValue(k, v, { shouldDirty: true });
      onExtras?.(res);
      toast.success(`${Object.keys(res.fields).length} alan dolduruldu — şimdi diğer dillere çevriliyor`);
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    } finally {
      setDrafting(false);
    }
    await autoTranslate();
  };

  return (
    <Tabs value={lang} onValueChange={(v) => setLang(v as Locale)} className={cn('gap-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <span>Adını yazıp “AI ile doldur”a basın: boş alanlar Türkçe dolar ve 10 dile çevrilir; bakıp kaydedin. Türkçeyi kendiniz yazarsanız da diğer diller kaydettikten bir iki dakika sonra kendiliğinden çevrilir.</span>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={aiFill} disabled={drafting || translating}>
            <SparklesIcon className="size-3.5" />
            {drafting ? 'Yazılıyor…' : 'AI ile doldur'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={autoTranslate} disabled={translating || drafting}>
            <Languages className="size-3.5" />
            {translating ? 'Çevriliyor…' : 'Otomatik çevir'}
          </Button>
        </div>
      </div>
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
