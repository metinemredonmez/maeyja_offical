/** Storefront languages. `tr` is the source of truth; others live in `translations[lang][field]`. */
export const LOCALES = ['tr', 'en', 'ru', 'nl', 'de', 'fr', 'it', 'es', 'ko', 'ja', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'tr';

export const LOCALE_LABELS: Record<Locale, string> = {
  tr: 'Türkçe',
  en: 'English',
  ru: 'Русский',
  nl: 'Nederlands',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
  ko: '한국어',
  ja: '日本語',
  zh: '中文',
};

export type Translations = Partial<Record<Locale, Record<string, string>>>;

/** Drops empty strings so the backend falls back to Turkish for untouched fields. */
export function cleanTranslations(t?: Translations | null): Translations | undefined {
  if (!t) return undefined;
  const out: Translations = {};
  for (const [lang, fields] of Object.entries(t)) {
    if (!fields) continue;
    const kept: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) if (typeof v === 'string' && v.trim() !== '') kept[k] = v;
    if (Object.keys(kept).length) out[lang as Locale] = kept;
  }
  return out;
}
