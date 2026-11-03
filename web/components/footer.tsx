import { useTranslations } from 'next-intl';
import { CookieSettingsButton } from './tracking';
import { Link } from '@/i18n/navigation';
import { LOCALE_LABELS, LOCALES } from '@/i18n/routing';
import { isExternal, useNavLabel } from '@/lib/navigation';
import type { Navigation, NavFooterLink } from '@/lib/types';
import { NewsletterForm } from './newsletter-form';

export function Footer({ instagram, nav }: { instagram: string; nav: Navigation['footer'] }) {
  const t = useTranslations('footer');
  const tn = useTranslations('newsletter');
  const label = useNavLabel();
  const col = 'flex flex-col gap-3 text-sm';
  const head = 'label mb-1 text-muted';
  const columns = nav.columns.filter((c) => c.visible);
  const item = (l: NavFooterLink, i: number) => {
    const text = label(l.label, l.key);
    if (l.href === '#cookies') return <CookieSettingsButton key={i} label={text} />;
    if (!l.href) return <span key={i} className="text-muted">{text}</span>;
    return isExternal(l.href) ? (
      <a key={i} href={l.href} rel="noopener" target="_blank">
        {text}
      </a>
    ) : (
      <Link key={i} href={l.href}>
        {text}
      </Link>
    );
  };
  return (
    <footer className="mt-24 border-t border-line px-4 pb-10 pt-16 md:mt-32 md:px-12">
      <div className={`grid gap-12 ${GRID[columns.length]}`}>
        <div className="flex flex-col gap-5">
          <p className="text-lg tracking-logo">MAEYJA</p>
          {nav.newsletter ? (
            <>
              <p className="max-w-xs text-sm leading-relaxed text-muted">{tn('title')}</p>
              <NewsletterForm compact />
            </>
          ) : null}
          {nav.instagram ? (
            <a href={instagram} rel="noopener" target="_blank" className="label hover:text-brand">
              Instagram
            </a>
          ) : null}
        </div>
        {columns.map((c) => {
          const title = label(c.title, c.key);
          return (
            <nav key={c.id} aria-label={title} className={col}>
              <p className={head}>{title}</p>
              {c.links.map(item)}
            </nav>
          );
        })}
      </div>
      <div className="mt-14 flex flex-col gap-4 border-t border-line pt-6 text-[11px] tracking-[0.08em] text-muted md:flex-row md:items-center md:justify-between">
        <span>{t('rights', { year: new Date().getFullYear() })}</span>
        {nav.languages ? (
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {LOCALES.map((l) => (
              <li key={l}>
                <Link href="/" locale={l} className="hover:text-ink">
                  {LOCALE_LABELS[l]}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {nav.payments ? <span>{t('securePayment')} · Visa · Mastercard</span> : null}
      </div>
    </footer>
  );
}

/** The brand column is twice as wide as each link column (Tailwind needs the class names written out). */
const GRID = [
  '',
  'md:grid-cols-[2fr_1fr]',
  'md:grid-cols-[2fr_1fr_1fr]',
  'md:grid-cols-[2fr_1fr_1fr_1fr]',
  'md:grid-cols-[2fr_1fr_1fr_1fr_1fr]',
  'md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr]',
  'md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr]',
];
