import type { MetadataRoute } from 'next';
import { LOCALES } from '@/i18n/routing';
import { absoluteUrl, localePath } from '@/lib/seo';

const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

async function list<T>(path: string): Promise<T[]> {
  try {
    const r = await fetch(`${API_URL}${path}`, { next: { revalidate: 3600 } });
    const j = (await r.json()) as { data?: { items?: T[] } | T[] };
    return Array.isArray(j.data) ? j.data : (j.data?.items ?? []);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, posts] = await Promise.all([list<{ slug: string; publishedAt: string | null }>('/catalog/products?limit=100'), list<{ slug: string; publishedAt: string | null }>('/content/journal?limit=100')]);
  const statics = ['/', '/products', '/journal', '/about', '/care', '/faq', '/contact', '/stockists', '/shipping-returns', '/order-status'];
  const entry = (path: string, lastModified?: string | null, priority = 0.6): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(path, 'en'),
    lastModified: lastModified ? new Date(lastModified) : undefined,
    priority,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE}${localePath(path, l)}`])) },
  });
  return [
    ...statics.map((p) => entry(p, null, p === '/' ? 1 : 0.7)),
    ...products.map((p) => entry(`/products/${p.slug}`, p.publishedAt, 0.9)),
    ...posts.map((p) => entry(`/journal/${p.slug}`, p.publishedAt, 0.5)),
  ];
}
