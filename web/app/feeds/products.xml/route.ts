import { apiGet } from '@/lib/api.server';
import { absoluteUrl } from '@/lib/seo';
import type { Product, ProductList } from '@/lib/types';

export const revalidate = 3600;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (html: string | null) => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Product feed for Google Merchant Center and the Meta catalogue (Google's RSS 2.0 format): one item per bag and
 * colour, with price, stock and photos. `?lang=en` for English titles and links; Turkish by default.
 */
export async function GET(request: Request) {
  const lang = new URL(request.url).searchParams.get('lang') === 'en' ? 'en' : 'tr';
  const list = await apiGet<ProductList>('/catalog/products?limit=100', { locale: lang, revalidate: 3600 }).catch(() => null);
  const products = (await Promise.all((list?.items ?? []).map((p) => apiGet<Product>(`/catalog/products/${p.slug}`, { locale: lang, revalidate: 3600 }).catch(() => null)))).filter(
    (p): p is Product => Boolean(p),
  );

  const items = products.flatMap((p) => {
    const byColour = new Map<string, Product['variants']>();
    for (const v of p.variants) byColour.set(v.color?.slug ?? '', [...(byColour.get(v.color?.slug ?? '') ?? []), v]);
    return [...byColour.entries()].map(([colour, variants]) => {
      const v = variants[0];
      const photos = p.images.filter((i) => !i.colorSlug || i.colorSlug === colour).map((i) => i.url);
      const colourName = v.color?.name ?? '';
      const fields = [
        ['g:id', v.sku],
        ['g:item_group_id', p.slug],
        ['g:title', `MAEYJA ${p.name}${colourName ? ` — ${colourName}` : ''}`],
        ['g:description', plain(p.description) || p.subtitle || p.name],
        ['g:link', `${absoluteUrl(`/products/${p.slug}`, lang)}${colour ? `?color=${colour}` : ''}`],
        ['g:image_link', photos[0] ?? ''],
        ...photos.slice(1, 10).map((u) => ['g:additional_image_link', u]),
        ['g:availability', variants.some((x) => x.inStock) ? 'in_stock' : 'out_of_stock'],
        ['g:price', `${(v.compareAtPrice ?? v.price).toFixed(2)} TRY`],
        ...(v.compareAtPrice ? [['g:sale_price', `${v.price.toFixed(2)} TRY`]] : []),
        ['g:brand', 'MAEYJA'],
        ['g:condition', 'new'],
        ['g:identifier_exists', 'no'],
        ['g:google_product_category', '3032'], // Apparel & Accessories > Handbags, Wallets & Cases > Handbags
        ['g:product_type', 'Bags'],
        ['g:color', colourName],
        ['g:material', plain(p.material) || 'Leather'],
        ['g:gender', 'female'],
        ['g:age_group', 'adult'],
      ].filter(([, value]) => value);
      return `    <item>\n${fields.map(([k, value]) => `      <${k}>${esc(value)}</${k}>`).join('\n')}\n    </item>`;
    });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>MAEYJA</title>
    <link>${esc(absoluteUrl('/', lang))}</link>
    <description>MAEYJA handcrafted leather bags</description>
${items.join('\n')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
