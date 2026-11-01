import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { apiGet, ApiError } from '@/lib/api.server';
import { formatDate } from '@/lib/format';
import { cleanHtml } from '@/lib/sanitize';
import { alternates } from '@/lib/seo';
import type { JournalPost } from '@/lib/types';

type Params = Promise<{ locale: string; slug: string }>;

async function load(slug: string, locale: string) {
  try {
    return await apiGet<JournalPost & { body: string }>(`/content/journal/${slug}`, { locale, revalidate: 120 });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const post = await load(slug, locale);
  return post ? { title: post.seoTitle ?? post.title, description: post.seoDescription ?? post.excerpt ?? undefined, alternates: alternates(`/journal/${slug}`, locale), openGraph: { type: 'article', images: post.coverImageUrl ? [post.coverImageUrl] : [] } } : {};
}

export default async function JournalPostPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await load(slug, locale);
  if (!post) notFound();
  // Structured data with the admin's note for AI assistants (falls back to the excerpt).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    abstract: post.aiSummary ?? post.excerpt ?? undefined,
    datePublished: post.publishedAt ?? undefined,
    image: post.coverImageUrl ?? undefined,
    author: { '@type': 'Organization', name: 'MAEYJA' },
    inLanguage: locale,
  };
  return (
    <article className="px-4 pt-12 md:px-12 md:pt-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <header className="mx-auto mb-12 flex max-w-3xl flex-col gap-5">
        <p className="label text-muted">{formatDate(post.publishedAt, locale)}</p>
        <h1 className="font-serif text-5xl font-light leading-none md:text-[64px]">{post.title}</h1>
        {post.excerpt ? <p className="font-serif text-2xl font-light italic text-ink-soft">{post.excerpt}</p> : null}
      </header>
      {post.coverImageUrl ? (
        // The whole photo, whatever its shape: a landscape spans the width, a portrait stands centred instead of being cropped.
        <Image src={post.coverImageUrl} alt="" width={1600} height={2000} priority sizes="(min-width: 768px) 80vw, 100vw" className="mx-auto mb-12 h-auto max-h-[85svh] w-auto max-w-full" />
      ) : null}
      <div className="prose-cms mx-auto max-w-3xl" dangerouslySetInnerHTML={{ __html: cleanHtml(post.body, locale) }} />
    </article>
  );
}
