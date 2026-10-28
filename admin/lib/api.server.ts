import 'server-only';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';

/**
 * Server Component helper: calls the backend directly with the access token read
 * from the httpOnly cookie. Never used at build time (all pages are dynamic).
 */
const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:4000/api').replace(/\/$/, '');

export class ServerApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

export async function serverGet<T>(path: string): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const res = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T; message?: string | string[] } | null;
  if (!res.ok || !json?.success) {
    const msg = json?.message;
    throw new ServerApiError(Array.isArray(msg) ? msg.join(', ') : (msg ?? `İstek başarısız (${res.status})`), res.status);
  }
  return json.data as T;
}
