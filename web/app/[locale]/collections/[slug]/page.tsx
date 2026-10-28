import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { apiGet, ApiError } from '@/lib/api.server';
import { alternates } from '@/lib/seo';
import type { ProductCard } from '@/lib/types';
import { ProductGrid } from '@/components/product/product-grid';

type Params = Promise<{ locale: string; slug: string }>;
interface Collection { slug: string; name: string; description: string | null; coverImageUrl: string | null; seoTitle: string | null; seoDescription: string | null; products: ProductCard[] }

async function load(slug: string, locale: string) {
  try {
    return await apiGet<Collection>(`/catalog/collections/${slug}`, { locale, revalidate: 60 });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const c = await load(slug, locale);
  return c ? { title: c.seoTitle ?? c.name, description: c.seoDescription ?? c.description ?? undefined, alternates: alternates(`/collections/${slug}`, locale) } : {};
}

export default async function CollectionPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const c = await load(slug, locale);
  if (!c) notFound();
  return (
    <div className="px-4 pt-12 md:px-12 md:pt-20">
      <div className="mb-12 flex max-w-2xl flex-col gap-4">
        <h1 className="font-serif text-5xl font-light leading-none md:text-[56px]">{c.name}</h1>
        {c.description ? <p className="text-[15px] leading-relaxed text-ink-soft">{c.description}</p> : null}
      </div>
      <ProductGrid products={c.products} columns={3} />
    </div>
  );
}
