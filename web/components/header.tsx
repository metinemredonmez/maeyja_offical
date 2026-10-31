import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { ProductCard, User } from '@/lib/types';
import { LanguageSwitcher } from './language-switcher';
import { CartButton } from './cart/cart-button';
import { MobileMenu } from './mobile-menu';
import { HeaderShell } from './header-shell';
import { MegaItem } from './mega-menu';

type MenuModel = Pick<ProductCard, 'slug' | 'name'>;

/**
 * BOYY's bar: small serif capitals on white, the wordmark in the middle, the bag on the right. The Bags menu
 * lists each model once (a model's colourways are separate pages; the first one opens).
 */
export function Header({ announcement, user, models }: { announcement: string | null; user: User | null; models: MenuModel[] }) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const byModel = models.filter((m, i) => models.findIndex((x) => x.name === m.name) === i);
  const mobileLinks = [
    { href: '/products', label: t('bags') },
    { href: '/expertise', label: t('expertise') },
    { href: '/journal', label: t('journal') },
    { href: '/stockists', label: t('stores') },
  ];
  return (
    <HeaderShell>
      {announcement ? <div className="label bg-ink px-4 py-2 text-center text-ground">{announcement}</div> : null}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 md:px-10">
        <nav aria-label={t('menu')} className="label hidden items-center gap-7 md:flex">
          <MegaItem label={t('bags')}>
            <div className="flex gap-16 px-10 py-8">
              <ul className="flex flex-col gap-2 text-[15px] normal-case tracking-normal">
                {byModel.map((m) => (
                  <li key={m.slug}>
                    <Link href={`/products/${m.slug}`} className="italic hover:opacity-60">
                      {m.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/products" className="link-underline self-start">
                {tc('viewAll')}
              </Link>
            </div>
          </MegaItem>
          <Link href="/expertise" className="hover:opacity-60">
            {t('expertise')}
          </Link>
          <Link href="/journal" className="hover:opacity-60">
            {t('journal')}
          </Link>
        </nav>
        <MobileMenu links={mobileLinks} />
        <Link href="/" aria-label={t('home')} data-wordmark className="wordmark pl-[0.42em] text-lg tracking-logo md:text-xl">
          MAEYJA
        </Link>
        <div className="label flex items-center justify-end gap-5 md:gap-6">
          <Link href="/stockists" className="hidden hover:opacity-60 md:inline">
            {t('stores')}
          </Link>
          <LanguageSwitcher />
          <Link href={user ? '/account' : '/account/login'} className="hidden hover:opacity-60 md:inline">
            {user ? (user.firstName ?? t('account')) : t('account')}
          </Link>
          <CartButton label={t('cart')} />
        </div>
      </div>
    </HeaderShell>
  );
}
