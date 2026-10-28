import { getTranslations, setRequestLocale } from 'next-intl/server';
import { apiGet } from '@/lib/api.server';
import { alternates } from '@/lib/seo';
import type { ProductList } from '@/lib/types';
import { ProductGrid } from '@/components/product/product-grid';
import { Filters } from '@/components/product/filters';
import { Pagination } from '@/components/pagination';
import { Link } from '@/i18n/navigation';

type Search = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shop' });
  return { title: t('title'), description: t('intro'), alternates: alternates('/products', locale) };
}

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations('shop');
  const tn = await getTranslations('newsletter');

  const qs = new URLSearchParams();
  for (const key of ['color', 'size', 'sort', 'category', 'collection', 'minPrice', 'maxPrice', 'q']) {
    const v = str(sp[key]);
    if (v) qs.set(key, v);
  }
  qs.set('page', str(sp.page) ?? '1');
  qs.set('limit', '24');

  const list = await apiGet<ProductList>(`/catalog/products?${qs}`, { locale, revalidate: 60 }).catch<ProductList | null>(() => null);
  const items = list?.items ?? [];

  return (
    <div className="px-4 pt-12 md:px-12 md:pt-20">
      <div className="grid items-end gap-6 md:grid-cols-12">
        <div className="flex flex-col gap-4 md:col-span-6">
          <h1 className="font-serif text-5xl font-light leading-none md:text-[56px]">{t('title')}</h1>
          <p className="max-w-lg text-[15px] leading-relaxed text-ink-soft">{t('intro')}</p>
        </div>
        <p className="text-xs text-muted md:col-span-3 md:col-start-10 md:text-right">{t('count', { count: list?.total ?? 0 })}</p>
      </div>

      <Filters facets={list?.facets ?? { colors: [], sizes: [], price: null }} current={{ color: str(sp.color), size: str(sp.size), sort: str(sp.sort) }} />

      {items.length ? (
        <div className="pt-10">
          <ProductGrid products={items} columns={3} />
          <Pagination page={list!.page} pages={list!.pages} />
        </div>
      ) : (
        <p className="py-24 text-center text-muted">{t('empty')}</p>
      )}

      <section className="mt-24 grid gap-6 bg-ink p-8 text-ground md:mt-32 md:grid-cols-2 md:items-center md:p-16">
        <div className="flex flex-col gap-3">
          <p className="label text-stone-dark">{tn('waitlistTitle')}</p>
          <h2 className="font-serif text-4xl font-light leading-tight">{tn('waitlistText')}</h2>
        </div>
        <Link href="/contact" className="btn-outline justify-self-start border-ground text-ground hover:bg-ground hover:text-ink">
          {tn('join')}
        </Link>
      </section>
    </div>
  );
}
