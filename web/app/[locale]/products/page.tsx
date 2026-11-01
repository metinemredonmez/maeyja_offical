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
  let items = list?.items ?? [];
  // Plain-language search ("a small black shoulder bag"): the AI picks and orders the matching pieces; if it can't
  // answer, the plain word search above stands.
  const q = str(sp.q)?.trim().slice(0, 120);
  if (q) {
    const ai = await apiGet<{ slugs: string[] }>(`/ai/search?q=${encodeURIComponent(q)}&locale=${locale}`, { locale, revalidate: 3600 }).catch(() => null);
    if (ai?.slugs.length) {
      const all = await apiGet<ProductList>(`/catalog/products?limit=100`, { locale, revalidate: 60 }).catch<ProductList | null>(() => null);
      if (all) {
        const bySlug = new Map(all.items.map((p) => [p.slug, p]));
        items = ai.slugs.flatMap((s) => bySlug.get(s) ?? []);
      }
    }
  }

  return (
    <div className="px-4 pt-12 md:px-12 md:pt-20">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="display text-[40px] md:text-[56px]">{t('title')}</h1>
        <p className="max-w-md text-[14px] leading-relaxed text-ink-soft">{t('intro')}</p>
        <form role="search" className="mt-2 flex w-full max-w-md items-center gap-3 border-b border-ink/25 focus-within:border-ink">
          <input
            name="q"
            defaultValue={q ?? ''}
            maxLength={120}
            placeholder={t('searchPlaceholder')}
            aria-label={t('search')}
            className="min-w-0 flex-1 bg-transparent py-2 text-center text-[14px] outline-none placeholder:text-muted"
          />
          <button type="submit" className="label shrink-0 py-2 text-ink">
            {t('search')}
          </button>
        </form>
        <p className="label text-muted">
          {q ? (
            <>
              {t('searchFor', { q })} · {t('count', { count: items.length })} ·{' '}
              <Link href="/products" className="underline underline-offset-4">
                {t('clear')}
              </Link>
            </>
          ) : (
            t('count', { count: list?.total ?? 0 })
          )}
        </p>
      </div>

      <Filters facets={list?.facets ?? { colors: [], sizes: [], price: null }} current={{ color: str(sp.color), size: str(sp.size), sort: str(sp.sort) }} />

      {items.length ? (
        <div className="pt-10">
          <ProductGrid products={items} columns={3} />
          {!q && <Pagination page={list!.page} pages={list!.pages} />}
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
