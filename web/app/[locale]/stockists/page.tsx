import { getTranslations, setRequestLocale } from 'next-intl/server';
import { apiGet } from '@/lib/api.server';
import { alternates } from '@/lib/seo';
import type { Stockist } from '@/lib/types';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'stockists' });
  return { title: t('title'), alternates: alternates('/stockists', locale) };
}

export default async function StockistsPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('stockists');
  const list = await apiGet<Stockist[]>('/content/stockists', { revalidate: 300 }).catch(() => []);
  return (
    <div className="px-4 pt-12 md:px-12 md:pt-20">
      <h1 className="mb-12 font-serif text-5xl font-light leading-none md:text-[56px]">{t('title')}</h1>
      <ul className="grid gap-10 sm:grid-cols-2 md:grid-cols-3">
        {list.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 border-t border-line pt-5 text-[15px] leading-relaxed">
            <p className="label text-muted">{s.city}</p>
            <p>{s.url ? <a href={s.url} rel="noopener" target="_blank" className="hover:text-brand">{s.name}</a> : s.name}</p>
            {s.address ? <p className="text-sm text-muted">{s.address}</p> : null}
            {s.phone ? <a href={`tel:${s.phone}`} className="text-sm text-muted hover:text-ink">{s.phone}</a> : null}
            {s.mapUrl ? <a href={s.mapUrl} rel="noopener" target="_blank" className="link-underline self-start">Map</a> : null}
          </li>
        ))}
        <li className="flex flex-col gap-2 border-t border-line pt-5 text-[15px] leading-relaxed">
          <p className="label text-muted">{t('online')}</p>
          <p>maeyja.com</p>
          <p className="text-sm text-muted">{t('worldwide')}</p>
        </li>
      </ul>
    </div>
  );
}
