import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter, Noto_Sans_JP, Noto_Sans_KR, Noto_Sans_SC, Tenor_Sans } from 'next/font/google';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { LOCALES, routing } from '@/i18n/routing';
import { apiGet, currentUser } from '@/lib/api.server';
import type { ProductList, PublicSettings, Stockist } from '@/lib/types';
import { cn } from '@/lib/format';
import { Providers } from '@/components/providers';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { CartDrawer } from '@/components/cart/cart-drawer';
import { NewsletterPopup } from '@/components/newsletter/newsletter-popup';
import { AssistantPanel } from '@/components/assistant/assistant-panel';
import '../globals.css';

const cormorant = Cormorant_Garamond({ subsets: ['latin', 'latin-ext', 'cyrillic'], weight: ['300', '400', '500'], style: ['normal', 'italic'], variable: '--font-cormorant', display: 'swap' });
const inter = Inter({ subsets: ['latin', 'latin-ext', 'cyrillic'], variable: '--font-inter', display: 'swap' });
// Menu, labels and buttons: small spaced capitals (Polène's sans counterpart).
const tenor = Tenor_Sans({ subsets: ['latin', 'latin-ext', 'cyrillic'], weight: '400', variable: '--font-tenor', display: 'swap' });
// CJK fallbacks are only attached on their locales so Latin pages stay light.
const notoJp = Noto_Sans_JP({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-cjk', display: 'swap', preload: false });
const notoKr = Noto_Sans_KR({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-cjk', display: 'swap', preload: false });
const notoSc = Noto_Sans_SC({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-cjk', display: 'swap', preload: false });

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(SITE),
    title: { default: `${t('siteName')} — ${t('tagline')}`, template: `%s — ${t('siteName')}` },
    description: t('description'),
    openGraph: { siteName: t('siteName'), type: 'website', locale },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const [settings, user, products, stockists] = await Promise.all([
    apiGet<PublicSettings>('/settings/public', { revalidate: 300 }).catch(() => null),
    currentUser(),
    // The Bags and Stores menus.
    apiGet<ProductList>('/catalog/products?limit=24', { locale, revalidate: 300 }).catch(() => null),
    apiGet<Stockist[]>('/content/stockists', { revalidate: 300 }).catch(() => []),
  ]);
  const models = (products?.items ?? []).map(({ slug, name, number }) => ({ slug, name, number }));
  const cjk = locale === 'ja' ? notoJp : locale === 'ko' ? notoKr : locale === 'zh' ? notoSc : null;

  return (
    <html lang={locale} className={cn(cormorant.variable, inter.variable, tenor.variable, cjk?.variable)}>
      <body className={cn('flex min-h-screen flex-col', cjk && 'font-[var(--font-inter),var(--font-cjk),sans-serif]')}>
        <NextIntlClientProvider>
          <Providers nonce={nonce}>
            <Header announcement={settings?.store.announcement?.[locale] || settings?.store.announcement?.tr || null} user={user} models={models} stockists={stockists} contactEmail={settings?.store.email || null} />
            <main className="flex-1">{children}</main>
            <Footer instagram={settings?.store.instagram ?? 'https://www.instagram.com/maeyja_official/'} />
            <CartDrawer />
            <NewsletterPopup />
            {settings?.assistant?.enabled ? <AssistantPanel welcome={settings.assistant.welcome?.[locale] || settings.assistant.welcome?.en || ''} /> : null}
            <Toaster position="bottom-center" toastOptions={{ className: 'font-sans text-sm' }} />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
