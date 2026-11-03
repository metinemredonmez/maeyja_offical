import type { NextResponse } from 'next/server';
import { COOKIE, cookieOptions } from './cookies';

export type Tokens = { accessToken?: string; refreshToken?: string };

const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');

/**
 * A refresh token works once (it rotates). Pages, their prefetches and API calls that find the access token expired
 * at the same moment share one refresh here; the answer is kept for a few seconds for requests still carrying the
 * old cookie, so none of them is taken for a stolen token (SES-05).
 */
const inflight = new Map<string, Promise<Tokens | 'invalid' | null>>();

/** New tokens; 'invalid' when the session is over (sign out); null when the API couldn't be reached (try again later). */
export function refreshSession(refreshToken: string, userAgent: string, ip?: string | null): Promise<Tokens | 'invalid' | null> {
  const running = inflight.get(refreshToken);
  if (running) return running;
  const call = (async () => {
    try {
      const r = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, ...(ip ? { 'X-Forwarded-For': ip } : {}) },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
      if (r.status === 401) return 'invalid' as const;
      if (!r.ok) return null;
      const json = (await r.json()) as { data?: Tokens };
      return json.data?.accessToken ? json.data : null;
    } catch {
      return null;
    }
  })();
  inflight.set(refreshToken, call);
  void call.finally(() => setTimeout(() => inflight.delete(refreshToken), 10_000));
  return call;
}

/** True when the access token is missing, unreadable or expires within a minute (its signature is the API's business). */
export function accessExpiring(token: string | undefined) {
  if (!token) return true;
  try {
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: number };
    return !exp || exp * 1000 - Date.now() < 60_000;
  } catch {
    return true;
  }
}

/** The old /api/auth-only refresh cookie goes whenever we write the session. */
const dropLegacy = (res: NextResponse) => res.cookies.set(COOKIE.legacyRefresh, '', { ...cookieOptions.refresh, path: '/api/auth', sameSite: 'strict', maxAge: 0 });

export function setTokens(res: NextResponse, t: Tokens) {
  if (t.accessToken) res.cookies.set(COOKIE.access, t.accessToken, cookieOptions.access);
  if (t.refreshToken) res.cookies.set(COOKIE.refresh, t.refreshToken, cookieOptions.refresh);
  dropLegacy(res);
}

export function clearTokens(res: NextResponse) {
  res.cookies.set(COOKIE.access, '', { ...cookieOptions.access, maxAge: 0 });
  res.cookies.set(COOKIE.refresh, '', { ...cookieOptions.refresh, maxAge: 0 });
  dropLegacy(res);
}
