'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api.client';

export function AccountNav() {
  const t = useTranslations('account');
  const ta = useTranslations('auth');
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const items = [
    { href: '/account', label: t('overview') },
    { href: '/account/orders', label: t('orders') },
    { href: '/account/addresses', label: t('addresses') },
    { href: '/account/wishlist', label: t('wishlist') },
  ];
  const logout = async () => {
    await api.post('/auth/logout').catch(() => undefined);
    qc.clear();
    router.replace('/');
    router.refresh();
  };
  return (
    <nav aria-label={t('title')} className="label flex flex-wrap gap-x-6 gap-y-3 md:col-span-2 md:flex-col">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={pathname === i.href || (i.href !== '/account' && pathname.startsWith(i.href)) ? 'text-brand' : 'hover:text-brand'}>
          {i.label}
        </Link>
      ))}
      <button type="button" onClick={logout} className="label text-left text-muted hover:text-brand md:mt-6">
        {ta('logout')}
      </button>
    </nav>
  );
}
