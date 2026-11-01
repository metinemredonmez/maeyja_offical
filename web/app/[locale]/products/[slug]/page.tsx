import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { apiGet, ApiError, currentUser } from '@/lib/api.server';
import { absoluteUrl, alternates } from '@/lib/seo';
import type { Product, ProductList, PublicSettings } from '@/lib/types';
import { BuyBox, type Sibling } from '@/components/product/buy-box';
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
  const [p, settings, user] = await Promise.all([load(slug, locale), apiGet<PublicSettings>('/settings/public', { revalidate: 60 }).catch(() => null), currentUser()]);
  if (!p) notFound();
  const wishlist = user ? await apiGet<{ product: { id: string } }[]>('/me/wishlist', { auth: true, locale }).catch(() => []) : [];
  const t = await getTranslations('product');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description ? p.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : undefined,
    sku: p.variants[0]?.sku,
    image: p.images.map((i) => i.url),
    // The admin's note for AI assistants.
    disambiguatingDescription: p.aiSummary ?? undefined,
    brand: { '@type': 'Brand', name: 'MAEYJA' },
    material: p.material ?? undefined,
    offers: p.variants.map((v) => ({
      '@type': 'Offer',
      sku: v.sku,
      price: v.price,
      priceCurrency: 'TRY',
      availability: v.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: absoluteUrl(`/products/${slug}`, locale),
      itemCondition: 'https://schema.org/NewCondition',
      // Google's merchant listings: 14-day returns by post.
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'TR',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 14,
        returnMethod: 'https://schema.org/ReturnByMail',
      },
    })),
  };

  // The model's other colourways are separate products with the same name (BOYY): reached from the swatches.
  const list = await apiGet<ProductList>('/catalog/products?limit=24', { locale, revalidate: 300 }).catch(() => null);
  const siblings: Sibling[] = (list?.items ?? [])
    .filter((x) => x.name === p.name && x.colors.length === 1)
    .map((x) => ({ slug: x.slug, name: x.colors[0].name, hex: x.colors[0].hex, hex2: x.colors[0].hex2 ?? null, current: x.slug === p.slug }));

  return (
    <div data-pdp>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <BuyBox product={p} shipping={settings?.shipping ?? null} wishlisted={wishlist.some((w) => w.product.id === p.id)} siblings={siblings} tryon={Boolean(settings?.tryon?.enabled)} />

      {p.related.length ? (
        <section className="mx-auto w-full max-w-[1280px] px-4 pt-24 md:px-10 md:pt-32">
          <h2 className="label mb-8 text-center">{t('pairsWith')}</h2>
          <ProductGrid products={p.related.slice(0, 4)} columns={4} />
        </section>
      ) : null}
    </div>
  );
}
