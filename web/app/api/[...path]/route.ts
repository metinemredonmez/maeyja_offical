import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, cookieOptions } from '@/lib/cookies';

/**
 * BFF proxy: the browser only ever talks to this origin. Tokens live in httpOnly cookies here
 * and are attached as headers on the way to the NestJS API, so no token is readable by page JS.
 */
const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-length', 'host', 'cookie']);
/** Routes whose JSON carries tokens: they are moved into cookies and stripped from the body. */
const AUTH_ROUTES = new Set(['auth/login', 'auth/register', 'auth/refresh', 'auth/logout', 'auth/change-password']);
/** Only the storefront's own API surface is proxied — never admin/*, never the admin login. */
const ALLOW: [RegExp, string[]][] = [
  [/^auth\/(login|register|logout|forgot-password|reset-password|verify-email|resend-verification|change-password)$/, ['POST']],
  [/^auth\/me$/, ['GET']],
  [/^(catalog|content|settings\/public|cart|checkout|orders|me|newsletter|contact|devices)(\/[\w.-]+)*$/, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']],
];
/** Request headers that may travel to the API. */
const FORWARD_HEADERS = ['accept', 'accept-language', 'content-type', 'user-agent'];
const SITE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001').origin;
  } catch {
    return 'http://localhost:3001';
  }
})();

/** CSRF: state-changing calls must come from our own pages (Origin / Sec-Fetch-Site) and from our client (custom header). */
function sameOrigin(req: NextRequest) {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const origin = req.headers.get('origin');
  const fetchSite = req.headers.get('sec-fetch-site');
  const originOk = origin ? origin === SITE_ORIGIN : fetchSite === 'same-origin' || fetchSite === null;
  return originOk && req.headers.get('x-requested-with') === 'mj';
}

type Tokens = { accessToken?: string; refreshToken?: string };

export const dynamic = 'force-dynamic';

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = path.join('/');
  const malformed = path.some((seg) => seg === '' || seg === '.' || seg === '..' || /[\\%]/.test(seg));
  if (malformed || !ALLOW.some(([re, methods]) => re.test(target) && methods.includes(req.method))) {
    return NextResponse.json({ success: false, statusCode: 404, message: 'Not found' }, { status: 404 });
  }
  if (!sameOrigin(req)) return NextResponse.json({ success: false, statusCode: 403, message: 'Forbidden' }, { status: 403 });
  const url = `${API_URL}/${target}${req.nextUrl.search}`;
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();

  if (target === 'auth/logout') return logout(req);

  let access = req.cookies.get(COOKIE.access)?.value;
  let upstream = await forward(req, url, body, access);

  // Access token expired: refresh once, retry once.
  const refresh = req.cookies.get(COOKIE.refresh)?.value;
  let rotated: Tokens | null = null;
  if (upstream.status === 401 && refresh && !AUTH_ROUTES.has(target)) {
    rotated = await refreshTokens(req, refresh);
    if (rotated?.accessToken) {
      access = rotated.accessToken;
      upstream = await forward(req, url, body, access);
    }
  }

  const res = await toResponse(upstream, AUTH_ROUTES.has(target));

  if (rotated) {
    setTokens(res, rotated);
  } else if (upstream.status === 401 && refresh && !AUTH_ROUTES.has(target)) {
    clearTokens(res);
  }

  // Guest cart token issued by the API → keep it for the browser session.
  const cartToken = upstream.headers.get('x-cart-token');
  if (cartToken) res.cookies.set(COOKIE.cart, cartToken, cookieOptions.cart);

  // Login/register: persist tokens, merge the guest cart into the account, hide tokens from JS.
  if ((target === 'auth/login' || target === 'auth/register' || target === 'auth/change-password') && upstream.ok) {
    const tokens = (res as NextResponse & { __tokens?: Tokens }).__tokens;
    if (tokens) {
      setTokens(res, tokens);
      const guestCart = req.cookies.get(COOKIE.cart)?.value;
      if (guestCart && tokens.accessToken) {
        await fetch(`${API_URL}/cart/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.accessToken}` },
          body: JSON.stringify({ cartToken: guestCart }),
        }).catch(() => undefined);
        res.cookies.set(COOKIE.cart, '', { ...cookieOptions.cart, maxAge: 0 });
      }
    }
  }
  return res;
}

async function forward(req: NextRequest, url: string, body: ArrayBuffer | undefined, access?: string) {
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }
  if (access) headers.set('Authorization', `Bearer ${access}`);
  const cart = req.cookies.get(COOKIE.cart)?.value;
  if (cart) headers.set('X-Cart-Token', cart);
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip');
  if (ip) headers.set('X-Forwarded-For', ip);
  return fetch(url, { method: req.method, headers, body, redirect: 'manual', cache: 'no-store' });
}

async function refreshTokens(req: NextRequest, refreshToken: string): Promise<Tokens | null> {
  try {
    const r = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': req.headers.get('user-agent') ?? '' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const json = (await r.json()) as { data?: Tokens };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/** Copies the upstream response; for auth routes strips the tokens out of the JSON body. */
async function toResponse(upstream: Response, isAuth: boolean) {
  const headers = new Headers();
  upstream.headers.forEach((v, k) => {
    if (!HOP_BY_HOP.has(k.toLowerCase()) && k.toLowerCase() !== 'x-cart-token') headers.set(k, v);
  });
  if (!isAuth) return new NextResponse(upstream.body, { status: upstream.status, headers });

  const json = (await upstream.json().catch(() => null)) as { data?: Tokens & Record<string, unknown> } | null;
  const tokens: Tokens | undefined = json?.data?.accessToken ? { accessToken: json.data.accessToken, refreshToken: json.data.refreshToken } : undefined;
  if (json?.data) {
    delete json.data.accessToken;
    delete json.data.refreshToken;
  }
  headers.delete('content-encoding');
  const res = NextResponse.json(json, { status: upstream.status, headers });
  (res as NextResponse & { __tokens?: Tokens }).__tokens = tokens;
  return res;
}

async function logout(req: NextRequest) {
  const refresh = req.cookies.get(COOKIE.refresh)?.value;
  if (refresh) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    }).catch(() => undefined);
  }
  const res = NextResponse.json({ success: true, data: { ok: true } });
  clearTokens(res);
  return res;
}

function setTokens(res: NextResponse, t: Tokens) {
  if (t.accessToken) res.cookies.set(COOKIE.access, t.accessToken, cookieOptions.access);
  if (t.refreshToken) res.cookies.set(COOKIE.refresh, t.refreshToken, cookieOptions.refresh);
}

function clearTokens(res: NextResponse) {
  res.cookies.set(COOKIE.access, '', { ...cookieOptions.access, maxAge: 0 });
  res.cookies.set(COOKIE.refresh, '', { ...cookieOptions.refresh, maxAge: 0 });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
