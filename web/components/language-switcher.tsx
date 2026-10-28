'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/i18n/routing';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (next: Locale) => {
    setOpen(false);
    // Keep the same page, swap the locale segment; dynamic params are carried over.
    router.replace({ pathname, params } as never, { locale: next });
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={t('language')} onClick={() => setOpen((o) => !o)} className="label hover:text-brand">
        {locale.toUpperCase()}
      </button>
      {open ? (
        <ul role="listbox" aria-label={t('language')} className="absolute right-0 top-full z-40 mt-3 w-44 border border-line bg-ground py-2 shadow-sm">
          {LOCALES.map((l) => (
            <li key={l} role="option" aria-selected={l === locale}>
              <button type="button" onClick={() => choose(l)} className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm normal-case tracking-normal hover:bg-sand ${l === locale ? 'text-brand' : ''}`}>
                <span>{LOCALE_LABELS[l]}</span>
                <span className="label text-muted">{l}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
