import { setRequestLocale } from 'next-intl/server';
import { apiGet, currentUser } from '@/lib/api.server';
import type { Address, PublicSettings } from '@/lib/types';
import { CheckoutForm } from '@/components/checkout/checkout-form';

export const metadata = { robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [user, settings] = await Promise.all([currentUser(), apiGet<PublicSettings>('/settings/public', { revalidate: 300 }).catch(() => null)]);
  const addresses = user ? await apiGet<Address[]>('/me/addresses', { auth: true }).catch(() => []) : [];
  return <CheckoutForm user={user} addresses={addresses} settings={settings} />;
}
