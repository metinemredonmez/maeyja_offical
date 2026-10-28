import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { apiGet, ApiError } from '@/lib/api.server';
import { absoluteUrl, alternates } from '@/lib/seo';
import type { Product, PublicSettings } from '@/lib/types';
import { BuyBox } from '@/components/product/buy-box';
import { ProductGrid } from '@/components/product/product-grid';

type Params = Promise<{ locale: string; slug: string }>;

async function load(slug: string, locale: string) {
  try {
    return await apiGet<Product>(`/catalog/products/${slug}`, { locale, revalidate: 60 });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await load(slug, locale);
  if (!p) return {};
  return {
    title: p.seoTitle ?? p.name,
    description: p.seoDescription ?? p.subtitle ?? p.description?.slice(0, 160),
    alternates: alternates(`/products/${slug}`, locale),
    openGraph: { images: p.images[0] ? [{ url: p.images[0].url }] : [] },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [p, settings] = await Promise.all([load(slug, locale), apiGet<PublicSettings>('/settings/public', { revalidate: 300 }).catch(() => null)]);
  if (!p) notFound();
  const t = await getTranslations('product');
  const tn = await getTranslations('nav');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description ?? undefined,
    image: p.images.map((i) => i.url),
    brand: { '@type': 'Brand', name: 'MAEYJA' },
    material: p.material ?? undefined,
    offers: p.variants.map((v) => ({
      '@type': 'Offer',
      sku: v.sku,
      price: v.price,
      priceCurrency: 'TRY',
      availability: v.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: absoluteUrl(`/products/${slug}`, locale),
    })),
  };

  return (
    <div className="px-4 pt-6 md:px-12 md:pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <p className="mb-4 text-[11px] tracking-label text-muted">
        <Link href="/products" className="uppercase hover:text-brand">
          {tn('bags')}
        </Link>{' '}
        / {p.name}
      </p>
      <BuyBox product={p} shipping={settings?.shipping ?? null} />

      {p.story ? (
        <section className="mt-24 grid bg-stone md:mt-32 md:grid-cols-2">
          <div className="flex flex-col justify-center gap-6 p-8 md:p-20">
            <p className="label text-muted">{t('atelier')}</p>
            <p className="font-serif text-3xl font-light leading-snug md:text-[40px]">{p.story}</p>
            {p.madeIn ? <p className="text-sm text-muted">{t('madeIn')}: {p.madeIn}</p> : null}
          </div>
          <div className="ph min-h-[320px] md:min-h-[520px]" />
        </section>
      ) : null}

      {p.related.length ? (
        <section className="pt-24 md:pt-32">
          <h2 className="mb-8 font-serif text-4xl font-light">{t('related')}</h2>
          <ProductGrid products={p.related} columns={4} />
        </section>
      ) : null}
    </div>
  );
}
