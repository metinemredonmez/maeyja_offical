import { useTranslations } from 'next-intl';
import { CookieSettingsButton } from './tracking';
import { Link } from '@/i18n/navigation';
import { LOCALE_LABELS, LOCALES } from '@/i18n/routing';
import { NewsletterForm } from './newsletter-form';

/** BOYY's footer: one centred row of small capitals, the legal links under it, nothing heavier. */
export function Footer({ instagram }: { instagram: string }) {
  const t = useTranslations('footer');
  const tn = useTranslations('newsletter');
  const nav = useTranslations('nav');
  const home = useTranslations('home');
  const tc = useTranslations('consent');
  return (
    <footer className="mt-28 px-4 pt-14 pb-8 md:mt-36 md:px-10">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-10 text-center">
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <p className="text-[14px] text-ink-soft">{tn('title')}</p>
          <NewsletterForm compact />
        </div>
        <nav aria-label={t('help')} className="label flex flex-wrap justify-center gap-x-6 gap-y-3">
          <Link href="/products" className="hover:opacity-60">{nav('bags')}</Link>
          <Link href="/about" className="hover:opacity-60">{t('about')}</Link>
          <Link href="/stockists" className="hover:opacity-60">{home('stockists')}</Link>
          <Link href="/shipping-returns" className="hover:opacity-60">{t('shippingReturns')}</Link>
          <Link href="/order-status" className="hover:opacity-60">{t('orderStatus')}</Link>
          <Link href="/care" className="hover:opacity-60">{t('care')}</Link>
          <Link href="/faq" className="hover:opacity-60">{t('faq')}</Link>
          <Link href="/contact" className="hover:opacity-60">{t('contact')}</Link>
          <a href={instagram} rel="noopener" target="_blank" className="hover:opacity-60">Instagram</a>
        </nav>
        <nav aria-label={t('legal')} className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] text-muted">
          <Link href="/distance-sales-agreement" className="hover:text-ink">{t('distance')}</Link>
          <Link href="/preliminary-information" className="hover:text-ink">{t('preliminary')}</Link>
          <Link href="/kvkk" className="hover:text-ink">{t('kvkk')}</Link>
          <Link href="/privacy" className="hover:text-ink">{t('privacy')}</Link>
          <Link href="/terms" className="hover:text-ink">{t('terms')}</Link>
          <CookieSettingsButton label={tc('settings')} />
        </nav>
        <div className="flex w-full flex-col items-center gap-3 border-t border-line pt-6 text-[11px] text-muted md:flex-row md:justify-between">
          <span>{t('rights', { year: new Date().getFullYear() })}</span>
          <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1">
            {LOCALES.map((l) => (
              <li key={l}>
                <Link href="/" locale={l} className="hover:text-ink">
                  {LOCALE_LABELS[l]}
                </Link>
              </li>
            ))}
          </ul>
          <span>{t('securePayment')} · Visa · Mastercard · Troy</span>
        </div>
      </div>
    </footer>
  );
}
