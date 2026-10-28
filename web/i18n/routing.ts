import { defineRouting } from 'next-intl/routing';

export const LOCALES = ['tr', 'en', 'ru', 'nl', 'de', 'fr', 'it', 'es', 'ko', 'ja', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

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

/** `/` is Turkish; every other language gets a prefix (`/en`, `/ja`, …). */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'tr',
  localePrefix: 'as-needed',
  localeDetection: true,
});
