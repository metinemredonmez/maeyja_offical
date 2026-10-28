'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button type="button" aria-label={open ? t('close') : t('menu')} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex h-11 w-11 items-center justify-center">
        <svg aria-hidden="true" width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.2">
          {open ? <path d="M2 1l16 12M18 1L2 13" /> : <path d="M0 1h20M0 7h20M0 13h20" />}
        </svg>
      </button>
      {open ? (
        <div className="fixed inset-x-0 top-[61px] bottom-0 z-40 flex flex-col gap-8 bg-ground px-6 py-10">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="font-serif text-3xl font-light">
              {l.label}
            </Link>
          ))}
          <div className="label mt-auto flex flex-col gap-4 border-t border-line pt-6">
            <Link href="/account">{t('account')}</Link>
            <Link href="/order-status">{t('search')}</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
