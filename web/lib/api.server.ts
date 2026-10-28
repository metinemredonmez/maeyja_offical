import 'server-only';
import { cookies, headers } from 'next/headers';
import { COOKIE } from './cookies';

const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Envelope<T> = { success: boolean; data: T; message?: string | string[]; statusCode?: number };

interface Options {
  /** Seconds; omit for no-store (personal data). */
  revalidate?: number;
  locale?: string;
  /** Attach the signed-in customer's token (account pages, cart). */
  auth?: boolean;
}

/**
 * Server Components call the API directly. Catalog/content requests are cached per locale;
 * anything personal passes the customer's cookie token and is never cached.
 */
export async function apiGet<T>(path: string, opts: Options = {}): Promise<T> {
  const h = new Headers({ Accept: 'application/json' });
  if (opts.locale) h.set('Accept-Language', opts.locale);
  if (opts.auth) {
    const jar = await cookies();
    const access = jar.get(COOKIE.access)?.value;
    const cart = jar.get(COOKIE.cart)?.value;
    if (access) h.set('Authorization', `Bearer ${access}`);
    if (cart) h.set('X-Cart-Token', cart);
    const ip = (await headers()).get('x-forwarded-for');
    if (ip) h.set('X-Forwarded-For', ip);
  }
  const sep = path.includes('?') ? '&' : '?';
  const url = `${API_URL}${path}${opts.locale ? `${sep}lang=${opts.locale}` : ''}`;
  const res = await fetch(url, {
    headers: h,
    ...(opts.auth || opts.revalidate === undefined ? { cache: 'no-store' } : { next: { revalidate: opts.revalidate } }),
  });
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !json?.success) {
    const msg = json?.message;
    throw new ApiError(Array.isArray(msg) ? msg.join(', ') : (msg ?? `API ${res.status}`), res.status);
  }
  return json.data;
}

/** Signed-in customer or null — safe to call from any server component. */
export async function currentUser() {
  const jar = await cookies();
  if (!jar.get(COOKIE.access) && !jar.get(COOKIE.refresh)) return null;
  try {
    return await apiGet<import('./types').User>('/auth/me', { auth: true });
  } catch {
    return null;
  }
}
