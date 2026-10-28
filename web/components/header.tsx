import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { User } from '@/lib/types';
import { LanguageSwitcher } from './language-switcher';
import { CartButton } from './cart/cart-button';
import { MobileMenu } from './mobile-menu';

export function Header({ announcement, user }: { announcement: string | null; user: User | null }) {
  const t = useTranslations('nav');
  const links = [
    { href: '/products', label: t('bags') },
    { href: '/about', label: t('atelier') },
    { href: '/journal', label: t('journal') },
  ];
  return (
    <>
      {announcement ? <div className="label bg-ink px-4 py-2.5 text-center text-ground">{announcement}</div> : null}
      <header className="sticky top-0 z-30 border-b border-line bg-ground/95 backdrop-blur">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 md:px-12 md:py-5">
          <nav aria-label={t('menu')} className="label hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-brand">
                {l.label}
              </Link>
            ))}
          </nav>
          <MobileMenu links={links} />
          <Link href="/" aria-label={t('home')} className="pl-[0.42em] text-lg tracking-logo md:text-xl">
            MAEYJA
          </Link>
          <div className="label flex items-center justify-end gap-5 md:gap-7">
            <LanguageSwitcher />
            <Link href={user ? '/account' : '/account/login'} className="hidden hover:text-brand md:inline">
              {user ? (user.firstName ?? t('account')) : t('account')}
            </Link>
            <CartButton label={t('cart')} />
          </div>
        </div>
      </header>
    </>
  );
}
