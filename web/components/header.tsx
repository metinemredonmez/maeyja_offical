import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { User } from '@/lib/types';
import { CartButton } from './cart/cart-button';
import { HeaderShell } from './header-shell';

/** Only the wordmark, the account and the bag up here; the rest of the shop (and the languages) is in the footer. */
export function Header({ announcement, user }: { announcement: string | null; user: User | null }) {
  const t = useTranslations('nav');
  return (
    <HeaderShell>
      {announcement ? <div className="label bg-ink px-4 py-2.5 text-center text-ground">{announcement}</div> : null}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 md:px-12 md:py-5">
        <span aria-hidden="true" />
        <Link href="/" aria-label={t('home')} data-wordmark className="wordmark pl-[0.42em] text-lg tracking-logo md:text-xl">
          MAEYJA
        </Link>
        <div className="label flex items-center justify-end gap-5 md:gap-7">
          <Link href={user ? '/account' : '/account/login'} className="hover:text-brand">
            {user ? (user.firstName ?? t('account')) : t('account')}
          </Link>
          <CartButton label={t('cart')} />
        </div>
      </div>
    </HeaderShell>
  );
}
