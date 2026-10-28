import { type NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, accessCookieOptions, refreshCookieOptions } from '@/lib/auth-cookies';

/**
 * BFF proxy: the browser only ever talks to `/api/*` on its own origin.
 * - Allowlisted paths only (`auth/<known>` and `admin/**`); everything else is 404.
 * - Adds `Authorization: Bearer <mj_at>` from the httpOnly cookie; forwards an
 *   allowlist of request headers, never the whole set.
 * - CSRF: non-GET requests need `X-Requested-With: mj` and a same-origin Origin /
 *   Sec-Fetch-Site.
 * - Login / MFA / change-password / refresh / logout are handled specially: tokens go
 *   to cookies and are stripped from the response body; only `user` is returned.
 * - Multipart bodies (media upload) and CSV responses pass through untouched.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const SITE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').origin;
  } catch {
    return 'http://localhost:3000';
  }
})();

type Ctx = { params: Promise<{ path: string[] }> };

const AUTH_ALLOW = /^auth\/(admin\/login|login\/mfa|refresh|logout|me|change-password|forgot-password|reset-password|mfa|mfa\/(setup|enable|disable|backup-codes))$/;

/** Auth actions whose success body carries a session → cookies. */
const TOKEN_ENDPOINTS = new Set(['admin/login', 'login/mfa', 'change-password']);

/** Request headers we are willing to forward verbatim. */
const FORWARD_HEADERS = ['accept', 'accept-language', 'content-type', 'user-agent'] as const;

type SessionPayload = { accessToken?: string; refreshToken?: string; user?: unknown; ok?: boolean; mfaRequired?: boolean; mfaToken?: string };

const json = (status: number, message: string, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, statusCode: status, message, ...extra }, { status });

function setAuthCookies(res: NextResponse, tokens: { accessToken?: string; refreshToken?: string }) {
  if (tokens.accessToken) res.cookies.set(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions);
  if (tokens.refreshToken) res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions);
}

function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, '', { ...accessCookieOptions, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { ...refreshCookieOptions, maxAge: 0 });
}

function upstreamHeaders(req: NextRequest, accessToken?: string) {
  const headers = new Headers();
  for (const h of FORWARD_HEADERS) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Real client IP for backend rate limiting; prefer the proxy chain, fall back to the socket.
  const xff = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip');
  if (xff) headers.set('x-forwarded-for', xff);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  return headers;
}

function csrfOk(req: NextRequest) {
  if (req.headers.get('x-requested-with') !== 'mj') return false;
  const origin = req.headers.get('origin');
  if (origin) return origin === SITE_ORIGIN;
  const site = req.headers.get('sec-fetch-site');
  return site === null || site === 'same-origin';
}

async function refreshTokens(req: NextRequest, refreshToken: string) {
  try {
    const headers = upstreamHeaders(req);
    headers.set('content-type', 'application/json');
    const r = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers, body: JSON.stringify({ refreshToken }), cache: 'no-store' });
    if (!r.ok) return null;
    const body = (await r.json()) as { success?: boolean; data?: SessionPayload };
    const data = body?.data;
    if (!data?.accessToken || !data?.refreshToken) return null;
    return data;
  } catch {
    return null;
  }
}

function passthrough(upstream: Response, body: BodyInit | null) {
  const headers = new Headers();
  for (const h of ['content-type', 'content-disposition', 'content-language']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new NextResponse(body, { status: upstream.status, headers });
}

async function handler(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;

  // ── path hygiene + allowlist ──
  if (!path?.length || path.some((s) => s === '' || s === '.' || s === '..' || s.includes('\\') || s.includes('%'))) return json(404, 'Not Found');
  const joined = path.join('/');
  const isAuth = path[0] === 'auth';
  if (!(isAuth ? AUTH_ALLOW.test(joined) : path[0] === 'admin' && path.length >= 2)) return json(404, 'Not Found');
  const authAction = isAuth ? path.slice(1).join('/') : '';

  const method = req.method.toUpperCase();
  const mutating = method !== 'GET' && method !== 'HEAD';
  if (mutating && !csrfOk(req)) return json(403, 'İstek reddedildi (CSRF)');

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  const url = `${API_URL}/${joined}${req.nextUrl.search}`;
  const body = mutating ? await req.arrayBuffer() : undefined;

  // ── auth/refresh: use the cookie, never a client-supplied token ──
  if (isAuth && authAction === 'refresh') {
    if (!refreshToken) {
      const res = json(401, 'Oturum bulunamadı');
      clearAuthCookies(res);
      return res;
    }
    const tokens = await refreshTokens(req, refreshToken);
    if (!tokens) {
      const res = json(401, 'Oturum süresi doldu');
      clearAuthCookies(res);
      return res;
    }
    const res = NextResponse.json({ success: true, data: { user: tokens.user ?? null } });
    setAuthCookies(res, tokens);
    return res;
  }

  // ── auth/logout: revoke the refresh token server-side, then drop cookies ──
  if (isAuth && authAction === 'logout') {
    if (refreshToken) {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }), cache: 'no-store' }).catch(() => null);
    }
    const res = NextResponse.json({ success: true, data: { ok: true } });
    clearAuthCookies(res);
    return res;
  }

  const init: RequestInit = {
    method,
    headers: upstreamHeaders(req, accessToken),
    body: body ? Buffer.from(body) : undefined,
    redirect: 'manual',
    cache: 'no-store',
  };

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch {
    return json(502, 'Sunucuya ulaşılamıyor');
  }

  // ── login / mfa / change-password: move tokens into cookies, strip from body ──
  if (isAuth && TOKEN_ENDPOINTS.has(authAction) && upstream.ok) {
    const parsed = (await upstream.json().catch(() => null)) as { success?: boolean; data?: SessionPayload } | null;
    const data = parsed?.data;
    // TOTP second step pending: no tokens yet, hand the short-lived mfaToken to the login form.
    if (data?.mfaRequired) return NextResponse.json({ success: true, data: { mfaRequired: true, mfaToken: data.mfaToken } }, { status: upstream.status });
    const res = NextResponse.json({ success: true, data: { ok: true, user: data?.user ?? null } }, { status: upstream.status });
    if (data?.accessToken || data?.refreshToken) setAuthCookies(res, { accessToken: data.accessToken, refreshToken: data.refreshToken });
    return res;
  }

  // ── 401: refresh-once when the refresh cookie is in scope; otherwise let the client refresh via /api/auth/refresh ──
  if (upstream.status === 401 && !(isAuth && (authAction === 'admin/login' || authAction === 'login/mfa'))) {
    if (refreshToken) {
      const tokens = await refreshTokens(req, refreshToken);
      if (!tokens) {
        const res = json(401, 'Oturum süresi doldu');
        clearAuthCookies(res);
        return res;
      }
      const retry = await fetch(url, { ...init, headers: upstreamHeaders(req, tokens.accessToken) }).catch(() => null);
      if (!retry) return json(502, 'Sunucuya ulaşılamıyor');
      const res = passthrough(retry, await retry.arrayBuffer());
      setAuthCookies(res, tokens);
      return res;
    }
  }

  return passthrough(upstream, await upstream.arrayBuffer());
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
