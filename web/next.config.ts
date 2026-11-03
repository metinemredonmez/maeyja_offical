import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const imageHosts = (process.env.IMAGE_HOSTS ?? 'localhost')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

// CSP is set per request in proxy.ts (nonce). These are the static headers; X-Frame-Options is set there too, since
// a staff preview may be framed by the admin.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

/** Kasım 2026: the bags took their Petal names; old links (Instagram, Google, e-mails) still reach the same bag. */
const RENAMED: Record<string, string> = {
  origami: 'petal-box-chili',
  frame: 'petal-shoulder-24-botanic',
  duo: 'petal-shoulder-24-black-moon',
  cube: 'petal-shoulder-14-black',
  valise: 'petal-lady-moon',
  lune: 'petal-cuff-15-5-black',
  tulip: 'petal-bucket-12-chili',
  drape: 'petal-bucket-20-botanic',
};

const nextConfig: NextConfig = {
  // deploy.sh builds next to the running version (.next-a / .next-b) and switches over; dev keeps .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    // Local dev only: the API is on 127.0.0.1, which Next refuses to optimise by default (SSRF guard).
    // In production IMAGE_HOSTS is the public API host, so this stays false.
    dangerouslyAllowLocalIP: imageHosts.every((h) => h === 'localhost' || h === '127.0.0.1'),
    remotePatterns: imageHosts.flatMap((hostname) => [
      { protocol: 'https' as const, hostname },
      { protocol: 'http' as const, hostname },
    ]),
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // The BFF API never goes through the proxy.
      { source: '/api/(.*)', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
    ];
  },
  async redirects() {
    return Object.entries(RENAMED).flatMap(([from, to]) => [
      { source: `/products/${from}`, destination: `/products/${to}`, permanent: true },
      { source: `/:locale(tr|ru|nl|de|fr|it|es|ko|ja|zh)/products/${from}`, destination: `/:locale/products/${to}`, permanent: true },
    ]);
  },
};

export default withNextIntl(nextConfig);
