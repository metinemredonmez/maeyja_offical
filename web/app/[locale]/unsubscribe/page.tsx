import { setRequestLocale } from 'next-intl/server';
import { Unsubscribe } from '@/components/newsletter/unsubscribe';
import { ForgetQuery } from '@/components/forget-query';

export const metadata = { robots: { index: false } };

export default async function UnsubscribePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ r?: string; t?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { r = '', t = '' } = await searchParams;
  return (
    <>
      <ForgetQuery />
      <Unsubscribe r={r} t={t} />
    </>
  );
}
