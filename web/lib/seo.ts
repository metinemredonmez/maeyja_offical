import { LOCALES } from '@/i18n/routing';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export const localePath = (path: string, locale: string) => `${locale === 'en' ? '' : `/${locale}`}${path === '/' ? '' : path}` || '/';

/** hreflang alternates for every language + x-default (English). */
export function alternates(path: string, locale: string) {
  return {
    canonical: `${SITE}${localePath(path, locale)}`,
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, `${SITE}${localePath(path, l)}`])),
      'x-default': `${SITE}${localePath(path, 'en')}`,
    },
  };
}

export const absoluteUrl = (path: string, locale: string) => `${SITE}${localePath(path, locale)}`;
