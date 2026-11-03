import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { COOKIE } from './lib/cookies';
import { accessExpiring, clearTokens, refreshSession, setTokens, type Tokens } from './lib/session';
import { maintenancePage, maintenanceState, PREVIEW_COOKIE, PREVIEW_HEADER } from './lib/maintenance';

const intl = createIntlMiddleware(routing);

/** Paths (locale prefix stripped) that need a signed-in customer. */
const PROTECTED = [/^\/account(?!\/(login|register|forgot-password|reset-password))/];

const stripLocale = (pathname: string) => pathname.replace(/^\/(tr|ru|nl|de|fr|it|es|ko|ja|zh)(?=\/|$)/, '') || '/';

/** The admin, the only page allowed to show the shop in a frame (its home page preview); maeyja.com → admin.maeyja.com. */
const ADMIN_ORIGIN = (() => {
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maeyja.com');
  if (process.env.ADMIN_URL) return new URL(process.env.ADMIN_URL).origin;
  return site.hostname === 'localhost' ? 'http://localhost:3000' : `${site.protocol}//admin.${site.hostname.replace(/^www\./, '')}`;
})();

// WEB-04: framing stays forbidden, except for staff carrying a valid preview cookie, and then only inside the admin.
const NO_FRAMES = { 'X-Frame-Options': 'DENY' };

function csp(nonce: string, preview: boolean) {
  const dev = process.env.NODE_ENV !== 'production';
  return [
    `default-src 'self'`,
    // Next's inline bootstrap scripts carry this nonce; strict-dynamic lets them load chunks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `media-src 'self' blob: https:${dev ? ' http:' : ''}`,
    `font-src 'self' data:`,
    // Ad pixels (loaded only after cookie consent): Meta and Google send their beacons here.
    `connect-src 'self' https://www.facebook.com https://connect.facebook.net https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.google.com https://*.doubleclick.net https://www.googleadservices.com${dev ? ' ws:' : ''}`,
    `frame-src https://*.iyzipay.com https://www.iyzico.com https://td.doubleclick.net https://www.googletagmanager.com`,
    `form-action 'self' https://*.iyzipay.com`,
    `frame-ancestors ${preview ? ADMIN_ORIGIN : "'none'"}`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Staff preview link from the admin (?preview=…): remember it in a cookie and continue on the clean address.
  const previewParam = request.nextUrl.searchParams.get('preview');
  if (previewParam) {
    const url = request.nextUrl.clone();
    url.searchParams.delete('preview');
    const res = NextResponse.redirect(url);
    res.cookies.set(PREVIEW_COOKIE, previewParam, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 7 * 24 * 3600 });
    return res;
  }
  // Maintenance mode (admin top bar): everyone but staff with the preview cookie sees the "back soon" page.
  const gate = await maintenanceState(request.cookies.get(PREVIEW_COOKIE)?.value);
  if (gate.enabled && !gate.preview) {
    const locale = pathname.match(/^\/(tr|ru|nl|de|fr|it|es|ko|ja|zh)(?=\/|$)/)?.[1] ?? 'en';
    return new NextResponse(maintenancePage(locale, gate.contact), {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '1800', ...NO_FRAMES },
    });
  }

  // The 15-minute access token ran out: renew it here, since pages (server components) can't set cookies themselves.
  const refresh = request.cookies.get(COOKIE.refresh)?.value;
  let renewed: Tokens | 'invalid' | null = null;
  if (refresh && accessExpiring(request.cookies.get(COOKIE.access)?.value)) {
    renewed = await refreshSession(refresh, request.headers.get('user-agent') ?? '', request.headers.get('x-forwarded-for'));
  }

  // Customer-only pages: bounce to login (keeping the target) when no session cookie at all.
  const path = stripLocale(pathname);
  const signedOut = renewed === 'invalid' || (!request.cookies.get(COOKIE.access) && !refresh);
  if (PROTECTED.some((re) => re.test(path)) && signedOut) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(path, '/account/login');
    url.searchParams.set('next', path);
    const res = NextResponse.redirect(url);
    if (renewed === 'invalid') clearTokens(res);
    return res;
  }

  // Per-request CSP nonce, handed to Next through the request headers.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = csp(nonce, gate.preview);
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', policy);
  // Pages skip their data cache for a verified preview, so a change saved in the admin shows on the next reload.
  headers.delete(PREVIEW_HEADER);
  if (gate.preview) headers.set(PREVIEW_HEADER, '1');
  // The page renders with the renewed session (or without the dead one).
  if (renewed) {
    const jar = new Map(request.cookies.getAll().map((c) => [c.name, c.value]));
    jar.delete(COOKIE.legacyRefresh);
    if (renewed === 'invalid') {
      jar.delete(COOKIE.access);
      jar.delete(COOKIE.refresh);
    } else {
      if (renewed.accessToken) jar.set(COOKIE.access, renewed.accessToken);
      if (renewed.refreshToken) jar.set(COOKIE.refresh, renewed.refreshToken);
    }
    headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
  }

  const response = intl(new NextRequest(request.url, { headers, method: request.method }));
  if (renewed === 'invalid') clearTokens(response);
  else if (renewed) setTokens(response, renewed);
  response.headers.set('Content-Security-Policy', policy);
  if (!gate.preview) response.headers.set('X-Frame-Options', NO_FRAMES['X-Frame-Options']);
  return response;
}

export const config = {
  // Everything except the BFF proxy, Next internals and static files.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
