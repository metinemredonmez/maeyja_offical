import { apiGet } from '@/lib/api.server';
import { modelNo } from '@/lib/format';
import type { JournalPost, Page, Paginated, ProductList, PublicSettings } from '@/lib/types';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export const revalidate = 3600;

/** The information pages listed below, with what to say when the admin hasn't written a note for AI assistants. */
const INFO: [slug: string, title: string, fallback: string][] = [
  ['about', 'About MAEYJA', 'the designer and the atelier'],
  ['expertise', 'Expertise', 'design, leather, stitching, artisans'],
  ['shipping-returns', 'Shipping & returns', 'delivery times and the 14-day return policy'],
  ['care', 'Leather care', 'how to look after the leather'],
];

/** One line, no line breaks: the summaries come from the admin (Yapay zekâ asistanları için). */
const oneLine = (text: string | null | undefined) => (text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * llms.txt (llmstxt.org): a plain summary of the shop for AI assistants — what MAEYJA is, every model with its
 * price and page, and the pages that answer the usual questions. English, the site's default language. Where the
 * admin wrote a note for AI assistants (next to the SEO fields), that note is used, translated to English.
 */
export async function GET() {
  const [settings, products, pages, journal] = await Promise.all([
    apiGet<PublicSettings>('/settings/public', { revalidate: 3600 }).catch(() => null),
    apiGet<ProductList>('/catalog/products?limit=100', { locale: 'en', revalidate: 3600 }).catch(() => null),
    Promise.all(INFO.map(([slug]) => apiGet<Page>(`/content/pages/${slug}`, { locale: 'en', revalidate: 3600 }).catch(() => null))),
    apiGet<Paginated<JournalPost>>('/content/journal?limit=20', { locale: 'en', revalidate: 3600 }).catch(() => null),
  ]);
  if (settings?.tracking && settings.tracking.allowAiCrawlers === false) return new Response('Not found', { status: 404 });
  const money = (n: number) => `TRY ${n.toLocaleString('en-US')}`;
  const lines = [
    '# MAEYJA',
    '',
    '> Handcrafted leather bags with sculptural forms, designed in France by Canan Delettre and cut and stitched by hand in an Istanbul atelier. Sold at maeyja.com (worldwide shipping, 11 languages) and at Beymen İstinye Park, Istanbul.',
    '',
    `Prices include VAT, in Turkish lira. Returns within 14 days. Contact: ${settings?.store.email ?? 'hello@maeyja.com'}.`,
    '',
    '## Bags',
    '',
    ...(products?.items ?? []).map(
      (p) =>
        `- [${modelNo(p.number) ? `${modelNo(p.number)} ` : ''}${p.name}](${SITE}/products/${p.slug}): ${oneLine(p.aiSummary) || p.subtitle || 'leather bag'}; ${p.hasPriceRange ? 'from ' : ''}${money(p.price)}; colours: ${p.colors.map((c) => c.name).join(', ') || '—'}; ${p.inStock ? 'in stock' : 'sold out'}`,
    ),
    '',
    '## Information',
    '',
    ...INFO.map(([slug, title, fallback], i) => `- [${title}](${SITE}/${slug}): ${oneLine(pages[i]?.aiSummary) || oneLine(pages[i]?.seoDescription) || fallback}`),
    `- [FAQ](${SITE}/faq)`,
    `- [Stockists](${SITE}/stockists)`,
    `- [Journal](${SITE}/journal)`,
    `- [Product feed](${SITE}/feeds/products.xml): every bag and colour with price and availability`,
    ...((journal?.items ?? []).some((j) => oneLine(j.aiSummary))
      ? ['', '## Journal', '', ...(journal?.items ?? []).filter((j) => oneLine(j.aiSummary)).map((j) => `- [${j.title}](${SITE}/journal/${j.slug}): ${oneLine(j.aiSummary)}`)]
      : []),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
