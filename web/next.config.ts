import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const imageHosts = (process.env.IMAGE_HOSTS ?? 'localhost')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

// CSP is set per request in proxy.ts (nonce). These are the static headers.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
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
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
