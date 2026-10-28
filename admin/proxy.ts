import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth-cookies';

// Next.js 16: `middleware` is now `proxy`. Two jobs: session gate + per-request CSP nonce.
// Authorization itself lives in the backend (roles); this only decides routing.
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

function nonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function csp(n: string) {
  const dev = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${n}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
}

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/\/+$/, '') || '/';
  const signedIn = Boolean(req.cookies.get(ACCESS_COOKIE)?.value) || Boolean(req.cookies.get(REFRESH_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!signedIn && !isPublic) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === '/login' && req.nextUrl.searchParams.get('expired') !== '1') {
    const next = req.nextUrl.searchParams.get('next');
    const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    return NextResponse.redirect(new URL(safe, req.url));
  }

  // Per-request nonce: Next.js reads it from the request CSP header and stamps its inline scripts.
  const n = nonce();
  const policy = csp(n);
  const headers = new Headers(req.headers);
  headers.set('x-nonce', n);
  headers.set('content-security-policy', policy);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('content-security-policy', policy);
  return res;
}

export const config = {
  matcher: ['/((?!api/|_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|json|css|js|map|woff|woff2|ttf)$).*)'],
};
