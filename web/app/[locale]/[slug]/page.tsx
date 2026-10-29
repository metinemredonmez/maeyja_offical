import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { apiGet, ApiError } from '@/lib/api.server';
import { cleanHtml } from '@/lib/sanitize';
import { alternates } from '@/lib/seo';
import type { Page } from '@/lib/types';

/** CMS pages: about, care, shipping-returns, kvkk, privacy, terms, distance-sales-agreement, preliminary-information … */
type Params = Promise<{ locale: string; slug: string }>;

async function load(slug: string, locale: string) {
  try {
    return await apiGet<Page>(`/content/pages/${slug}`, { locale, revalidate: 300 });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const page = await load(slug, locale);
  return page ? { title: page.seoTitle ?? page.title, description: page.seoDescription ?? undefined, alternates: alternates(`/${slug}`, locale) } : {};
}

export default async function CmsPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const page = await load(slug, locale);
  if (!page) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 pt-12 md:pt-20">
      <h1 className="mb-10 font-serif text-5xl font-light leading-none md:text-[56px]">{page.title}</h1>
      <div className="prose-cms" dangerouslySetInnerHTML={{ __html: cleanHtml(page.body, locale) }} />
    </article>
  );
}
