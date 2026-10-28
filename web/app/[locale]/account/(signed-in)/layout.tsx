import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ReactNode } from 'react';
import { currentUser } from '@/lib/api.server';
import { redirect } from '@/i18n/navigation';
import { AccountNav } from '@/components/account/account-nav';

export const metadata = { robots: { index: false } };

/** Every page under /account/* (except the auth forms) needs a session; the proxy already redirects when cookies are missing. */
export default async function AccountLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await currentUser();
  if (!user) redirect({ href: '/account/login', locale });
  const t = await getTranslations('account');
  return (
    <div className="px-4 pt-12 md:px-12 md:pt-20">
      <h1 className="mb-10 font-serif text-5xl font-light leading-none md:text-[56px]">{t('title')}</h1>
      <div className="grid gap-12 md:grid-cols-12">
        <AccountNav />
        <div className="md:col-span-8 md:col-start-4">{children}</div>
      </div>
    </div>
  );
}
