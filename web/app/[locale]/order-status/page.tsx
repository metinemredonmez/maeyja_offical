import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrderLookup } from '@/components/order/order-lookup';

export const metadata = { robots: { index: false } };

export default async function OrderStatusPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { order } = await searchParams;
  const t = await getTranslations('order');
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 md:pt-20">
      <h1 className="font-serif text-5xl font-light leading-none md:text-[56px]">{t('lookupTitle')}</h1>
      <p className="mt-4 text-[15px] text-ink-soft">{t('lookupText')}</p>
      <OrderLookup initialOrderNumber={order ?? ''} />
    </div>
  );
}
