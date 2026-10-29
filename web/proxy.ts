import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { COOKIE } from './lib/cookies';

const intl = createIntlMiddleware(routing);

/** Paths (locale prefix stripped) that need a signed-in customer. */
const PROTECTED = [/^\/account(?!\/(login|register|forgot-password|reset-password))/];

const stripLocale = (pathname: string) => pathname.replace(/^\/(tr|ru|nl|de|fr|it|es|ko|ja|zh)(?=\/|$)/, '') || '/';

function csp(nonce: string) {
  const dev = process.env.NODE_ENV !== 'production';
  return [
    `default-src 'self'`,
    // Next's inline bootstrap scripts carry this nonce; strict-dynamic lets them load chunks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `media-src 'self' blob: https:${dev ? ' http:' : ''}`,
    `font-src 'self' data:`,
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    `frame-src https://*.iyzipay.com https://www.iyzico.com`,
    `form-action 'self' https://*.iyzipay.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Customer-only pages: bounce to login (keeping the target) when no session cookie at all.
  const path = stripLocale(pathname);
  if (PROTECTED.some((re) => re.test(path)) && !request.cookies.get(COOKIE.access) && !request.cookies.get(COOKIE.refresh)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(path, '/account/login');
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // Per-request CSP nonce, handed to Next through the request headers.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = csp(nonce);
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', policy);

  const response = intl(new NextRequest(request.url, { headers, method: request.method }));
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  // Everything except the BFF proxy, Next internals and static files.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
