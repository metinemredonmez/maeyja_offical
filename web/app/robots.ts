import type { MetadataRoute } from 'next';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/account', '/checkout', '/cart', '/*/account', '/*/checkout', '/*/cart'] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
