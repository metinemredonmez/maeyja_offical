import { useTranslations } from 'next-intl';
import { CookieSettingsButton } from './tracking';
import { Link } from '@/i18n/navigation';
import { LOCALE_LABELS, LOCALES } from '@/i18n/routing';
import { NewsletterForm } from './newsletter-form';

export function Footer({ instagram }: { instagram: string }) {
  const t = useTranslations('footer');
  const tn = useTranslations('newsletter');
  const nav = useTranslations('nav');
  const home = useTranslations('home');
  const tc = useTranslations('consent');
  const col = 'flex flex-col gap-3 text-sm';
  const head = 'label mb-1 text-muted';
  return (
    <footer className="mt-24 border-t border-line px-4 pb-10 pt-16 md:mt-32 md:px-12">
      <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-5">
          <p className="text-lg tracking-logo">MAEYJA</p>
          <p className="max-w-xs text-sm leading-relaxed text-muted">{tn('title')}</p>
          <NewsletterForm compact />
          <a href={instagram} rel="noopener" target="_blank" className="label hover:text-brand">
            Instagram
          </a>
        </div>
        <nav aria-label={t('shop')} className={col}>
          <p className={head}>{t('shop')}</p>
          <Link href="/products">{nav('bags')}</Link>
          <span className="text-muted">{t('clothing')}</span>
          <Link href="/care">{t('care')}</Link>
          <Link href="/stockists">{home('stockists')}</Link>
          <Link href="/about">{t('about')}</Link>
        </nav>
        <nav aria-label={t('help')} className={col}>
          <p className={head}>{t('help')}</p>
          <Link href="/shipping-returns">{t('shippingReturns')}</Link>
          <Link href="/order-status">{t('orderStatus')}</Link>
          <Link href="/faq">{t('faq')}</Link>
          <Link href="/contact">{t('contact')}</Link>
        </nav>
        <nav aria-label={t('legal')} className={col}>
          <p className={head}>{t('legal')}</p>
          <Link href="/distance-sales-agreement">{t('distance')}</Link>
          <Link href="/preliminary-information">{t('preliminary')}</Link>
          <Link href="/kvkk">{t('kvkk')}</Link>
          <Link href="/privacy">{t('privacy')}</Link>
          <CookieSettingsButton label={tc('settings')} />
          <Link href="/terms">{t('terms')}</Link>
        </nav>
      </div>
      <div className="mt-14 flex flex-col gap-4 border-t border-line pt-6 text-[11px] tracking-[0.08em] text-muted md:flex-row md:items-center md:justify-between">
        <span>{t('rights', { year: new Date().getFullYear() })}</span>
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
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
    </footer>
  );
}
