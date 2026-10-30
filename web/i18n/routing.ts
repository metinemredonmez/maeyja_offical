import { defineRouting } from 'next-intl/routing';

export const LOCALES = ['en', 'tr', 'ru', 'nl', 'de', 'fr', 'it', 'es', 'ko', 'ja', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  tr: 'Türkçe',
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

/** `/` is English for everyone (no browser-language redirect); every other language gets a prefix (`/tr`, `/ja`, …). */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  localeDetection: false,
  // hreflang already comes from each page's metadata; the duplicate Link header pushed responses past nginx's 4 KB header buffer (502).
  alternateLinks: false,
});
