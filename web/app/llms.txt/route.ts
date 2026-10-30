import { apiGet } from '@/lib/api.server';
import { modelNo } from '@/lib/format';
import type { ProductList, PublicSettings } from '@/lib/types';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export const revalidate = 3600;

/**
 * llms.txt (llmstxt.org): a plain summary of the shop for AI assistants — what MAEYJA is, every model with its
 * price and page, and the pages that answer the usual questions. English, the site's default language.
 */
export async function GET() {
  const [settings, products] = await Promise.all([
    apiGet<PublicSettings>('/settings/public', { revalidate: 3600 }).catch(() => null),
    apiGet<ProductList>('/catalog/products?limit=100', { locale: 'en', revalidate: 3600 }).catch(() => null),
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
        `- [${modelNo(p.number) ? `${modelNo(p.number)} ` : ''}${p.name}](${SITE}/products/${p.slug}): ${p.subtitle ?? 'leather bag'}; ${p.hasPriceRange ? 'from ' : ''}${money(p.price)}; colours: ${p.colors.map((c) => c.name).join(', ') || '—'}; ${p.inStock ? 'in stock' : 'sold out'}`,
    ),
    '',
    '## Information',
    '',
    `- [About MAEYJA](${SITE}/about): the designer and the atelier`,
    `- [Expertise](${SITE}/expertise): design, leather, stitching, artisans`,
    `- [Shipping & returns](${SITE}/shipping-returns)`,
    `- [Leather care](${SITE}/care)`,
    `- [FAQ](${SITE}/faq)`,
    `- [Stockists](${SITE}/stockists)`,
    `- [Journal](${SITE}/journal)`,
    `- [Product feed](${SITE}/feeds/products.xml): every bag and colour with price and availability`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
