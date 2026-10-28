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
 * Missing or empty translated values fall back to the default text.
 */
export function localize<T extends WithTranslations>(entity: T, lang: Locale): Omit<T, 'translations'> {
  const { translations, ...rest } = entity;
  if (lang === DEFAULT_LOCALE || !translations || typeof translations !== 'object') return rest;
  const overlay = (translations as Record<string, Record<string, unknown>>)[lang];
  if (!overlay) return rest;
  const out: Record<string, unknown> = { ...rest };
  for (const [key, value] of Object.entries(overlay)) {
    if (value !== null && value !== undefined && value !== '' && key in rest) out[key] = value;
  }
  return out as Omit<T, 'translations'>;
}
