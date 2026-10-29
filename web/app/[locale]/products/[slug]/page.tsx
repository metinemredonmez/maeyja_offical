import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { apiGet, ApiError, currentUser } from '@/lib/api.server';
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
  const [p, settings, user] = await Promise.all([load(slug, locale), apiGet<PublicSettings>('/settings/public', { revalidate: 300 }).catch(() => null), currentUser()]);
  if (!p) notFound();
  const wishlist = user ? await apiGet<{ product: { id: string } }[]>('/me/wishlist', { auth: true, locale }).catch(() => []) : [];
  const atelierPhoto = p.images.length > 1 ? p.images[p.images.length - 1] : null;
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

  const crumb = (
    <p className="label text-[10px] text-ink-soft">
      <Link href="/products" className="hover:text-brand">
        {tn('bags')}
      </Link>{' '}
      / {p.name}
    </p>
  );

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <BuyBox product={p} shipping={settings?.shipping ?? null} wishlisted={wishlist.some((w) => w.product.id === p.id)} crumb={crumb} tryon={Boolean(settings?.tryon?.enabled)} />

      {/* The atelier note over a full-width photo of the bag. */}
      {p.story ? (
        <section className="relative mt-24 flex min-h-[70svh] items-end overflow-hidden bg-stone text-white md:mt-36">
          {atelierPhoto ? (
            <div className="parallax absolute inset-0">
              <Image src={atelierPhoto.url} alt="" fill sizes="100vw" className="object-cover" />
            </div>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" aria-hidden="true" />
          <div className="reveal relative flex max-w-3xl flex-col gap-5 px-5 pb-12 md:px-12 md:pb-16">
            <p className="label opacity-85">{t('atelier')}</p>
            <p className="font-serif text-[28px] leading-snug font-light md:text-[40px]">{p.story}</p>
            {p.madeIn ? <p className="label opacity-85">{t('madeIn')}: {p.madeIn}</p> : null}
          </div>
        </section>
      ) : null}

      {p.related.length ? (
        <section className="px-4 pt-24 md:px-12 md:pt-36">
          <h2 className="display mb-12 text-center text-[32px] md:text-[48px]">{t('pairsWith')}</h2>
          <ProductGrid products={p.related} columns={4} />
        </section>
      ) : null}
    </div>
  );
}
