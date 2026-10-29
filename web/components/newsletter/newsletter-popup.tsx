'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from '@/i18n/navigation';
import { NewsletterForm } from '@/components/newsletter-form';

const KEY = 'mj-newsletter-popup';
const DAY = 864e5;
/** Pages where an interruption would get in the way of finishing something. */
const QUIET = /^\/(cart|checkout|account|unsubscribe|verify-email|order-status)/;

/** Remembered "until" timestamp; storage may be unavailable (private mode), then it just shows again later. */
const snoozedUntil = () => {
  try {
    return Number(localStorage.getItem(KEY) ?? 0);
  } catch {
    return 0;
  }
};
const snooze = (days: number) => {
  try {
    localStorage.setItem(KEY, String(Date.now() + days * DAY));
  } catch {
    /* ignore */
  }
};

/**
 * Newsletter invitation (Wandler): appears once after 25 s or a few screens of scrolling, then stays away
 * for 30 days whether it was closed or ignored (a year after subscribing). Bottom sheet on phones.
 */
export function NewsletterPopup() {
  const t = useTranslations('newsletter');
  const nav = useTranslations('nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (QUIET.test(pathname) || snoozedUntil() > Date.now()) return;
    let timer = 0;
    const stop = () => {
      clearTimeout(timer);
      removeEventListener('scroll', onScroll);
    };
    // Showing it is what counts: it never comes back for 30 days, even if it is not closed.
    const show = () => {
      stop();
      if (snoozedUntil() > Date.now()) return;
      snooze(30);
      setOpen(true);
    };
    const onScroll = () => scrollY > innerHeight * 3 && show();
    timer = window.setTimeout(show, 25_000);
    addEventListener('scroll', onScroll, { passive: true });
    return stop;
  }, [pathname]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 md:items-center md:p-6" onClick={close}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nl-popup-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-ground px-8 pt-12 pb-10 text-center outline-none md:pb-12"
      >
        <button type="button" onClick={close} aria-label={nav('close')} className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center hover:text-brand">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
        <h2 id="nl-popup-title" className="display mx-auto max-w-xs text-[28px]">
          {t('title')}
        </h2>
        <p className="mt-3 text-sm text-ink-soft">{t('text')}</p>
        <div className="relative mx-auto my-8 aspect-[4/5] w-32">
          <Image src="/newsletter.webp" alt="" fill sizes="128px" className="object-contain mix-blend-multiply" />
        </div>
        <div className="text-left">
          <NewsletterForm
            source="popup"
            onDone={() => {
              snooze(365);
              setTimeout(() => setOpen(false), 2500);
            }}
          />
        </div>
      </div>
    </div>
  );
}
