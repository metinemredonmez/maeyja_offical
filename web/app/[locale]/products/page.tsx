import { getTranslations, setRequestLocale } from 'next-intl/server';
import { apiGet } from '@/lib/api.server';
import { alternates } from '@/lib/seo';
import type { ProductList } from '@/lib/types';
import { ProductGrid } from '@/components/product/product-grid';
import { Filters } from '@/components/product/filters';
import { Pagination } from '@/components/pagination';

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
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-8 md:px-10 md:pt-12">
      <h1 className="text-center text-[22px]">{t('title')}</h1>

      <Filters facets={list?.facets ?? { colors: [], sizes: [], price: null }} current={{ color: str(sp.color), size: str(sp.size), sort: str(sp.sort) }} />

      {items.length ? (
        <div className="pt-8">
          <ProductGrid products={items} columns={4} />
          <Pagination page={list!.page} pages={list!.pages} />
        </div>
      ) : (
        <p className="py-24 text-center text-muted">{t('empty')}</p>
      )}
    </div>
  );
}
