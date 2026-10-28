import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { apiGet } from '@/lib/api.server';
import { formatDate } from '@/lib/format';
import { alternates } from '@/lib/seo';
import type { JournalPost, Paginated } from '@/lib/types';
import { Pagination } from '@/components/pagination';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'journal' });
  return { title: t('title'), alternates: alternates('/journal', locale) };
}

export default async function JournalPage({ params, searchParams }: { params: Params; searchParams: Promise<{ page?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { page = '1' } = await searchParams;
  const t = await getTranslations('journal');
  const list = await apiGet<Paginated<JournalPost>>(`/content/journal?page=${page}&limit=12`, { locale, revalidate: 120 }).catch(() => null);
  const posts = list?.items ?? [];
  return (
    <div className="px-4 pt-12 md:px-12 md:pt-20">
      <h1 className="mb-12 font-serif text-5xl font-light leading-none md:text-[56px]">{t('title')}</h1>
      {posts.length ? (
        <div className="grid gap-x-6 gap-y-14 md:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.slug} href={`/journal/${p.slug}`} className="group flex flex-col gap-4">
              <div className="ph relative aspect-[4/3]">{p.coverImageUrl ? <Image src={p.coverImageUrl} alt="" fill sizes="33vw" className="object-cover" /> : null}</div>
              <p className="label text-muted">{formatDate(p.publishedAt, locale)}</p>
              <h2 className="font-serif text-2xl leading-tight group-hover:text-brand">{p.title}</h2>
              {p.excerpt ? <p className="text-sm leading-relaxed text-ink-soft">{p.excerpt}</p> : null}
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-24 text-center text-muted">{t('empty')}</p>
      )}
      {list ? <Pagination page={list.page} pages={list.pages} /> : null}
    </div>
  );
}
