const INTL_LOCALE: Record<string, string> = {
  tr: 'tr-TR', en: 'en-GB', ru: 'ru-RU', nl: 'nl-NL', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', es: 'es-ES', ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN',
};

/** Prices are always TRY; only the number formatting follows the UI language. */
export function money(amount: number, locale = 'tr') {
  return new Intl.NumberFormat(INTL_LOCALE[locale] ?? 'tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
}

export function formatDate(iso: string | null | undefined, locale = 'tr', opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  if (!iso) return '';
  return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? 'tr-TR', opts).format(new Date(iso));
}

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
