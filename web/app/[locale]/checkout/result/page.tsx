import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { currentUser } from '@/lib/api.server';
import { RetryPayment } from '@/components/checkout/retry-payment';

export const metadata = { robots: { index: false } };

/** iyzico sends the shopper back here via the API callback: ?order=MY-…&status=success|failed|review */
export default async function CheckoutResultPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string; status?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { order = '', status = 'failed' } = await searchParams;
  const t = await getTranslations('checkout');
  const user = await currentUser();
  const key = status === 'success' ? 'Success' : status === 'review' ? 'Review' : 'Failed';
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-24 text-center">
      <p className="label text-muted">{order}</p>
      <h1 className="font-serif text-4xl font-light md:text-5xl">{t(`result${key}`)}</h1>
      <p className="text-[15px] text-ink-soft">{t(`result${key}Text`, { orderNumber: order })}</p>
      {status === 'failed' && order ? <RetryPayment orderNumber={order} guest={!user} /> : null}
      {order ? (
        <Link href={user ? `/account/orders/${order}` : `/order-status?order=${order}`} className="link-underline mt-4">
          {t('trackOrder')}
        </Link>
      ) : null}
    </div>
  );
}
