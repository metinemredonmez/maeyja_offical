/** Storefront languages. `tr` is the source of truth; others live in `translations` JSON columns. */
export const LOCALES = ['tr', 'en', 'ru', 'nl', 'de', 'fr', 'it', 'es', 'ko', 'ja', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'tr';

/** Picks the first supported language from `?lang=` or an Accept-Language header (`fr-CA,fr;q=0.9,en;q=0.8`). */
export function resolveLocale(input: unknown): Locale {
  const candidates = String(input ?? '')
    .split(',')
    .map((part) => part.split(';')[0].trim().slice(0, 2).toLowerCase())
    .filter(Boolean);
  return (candidates.find((c) => (LOCALES as readonly string[]).includes(c)) as Locale | undefined) ?? DEFAULT_LOCALE;
}

type WithTranslations = { translations?: unknown };

/**
 * Overlays `translations[lang]` onto the entity's default (Turkish) fields and drops the raw column.
 * A missing or empty value falls back to English, then to the default text — so a Russian visitor
 * reads English rather than Turkish when a field has not been translated yet.
 */
export function localize<T extends WithTranslations>(entity: T, lang: Locale): Omit<T, 'translations'> {
  const { translations, ...rest } = entity;
  if (lang === DEFAULT_LOCALE || !translations || typeof translations !== 'object') return rest;
  const all = translations as Record<string, Record<string, unknown> | undefined>;
  const out: Record<string, unknown> = { ...rest };
  for (const overlay of lang === 'en' ? [all.en] : [all.en, all[lang]]) {
    for (const [key, value] of Object.entries(overlay ?? {})) {
      if (value !== null && value !== undefined && value !== '' && key in rest) out[key] = value;
    }
  }
  return out as Omit<T, 'translations'>;
}
