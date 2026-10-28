'use client';

/**
 * Browser-side API helper. Talks only to `/api/*` (BFF proxy), unwraps the
 * `{ success, data }` envelope and throws `ApiError` on failure.
 * On 401 it asks the proxy to refresh once; if that also fails the user is
 * sent to `/login`.
 */

export class ApiError extends Error {
  readonly statusCode: number;
  readonly messages: string[];
  /** Machine-readable code from the backend, e.g. `MFA_SETUP_REQUIRED`. */
  readonly code?: string;
  constructor(message: string | string[], statusCode: number, code?: string) {
    const list = Array.isArray(message) ? message : [message];
    super(list.join('\n'));
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.messages = list;
    this.code = code;
  }
  get isForbidden() {
    return this.statusCode === 403;
  }
  get isNetwork() {
    return this.statusCode === 0 || this.statusCode === 502;
  }
}

type Envelope<T> = { success: true; data: T } | { success: false; statusCode: number; message: string | string[]; code?: string };

export const MFA_SETUP_PATH = '/profile?mfa=setup';

function redirectToMfaSetup() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/profile') return;
  hardNavigate(MFA_SETUP_PATH);
}

type Options = { signal?: AbortSignal; retry?: boolean };

/** Full-page navigation: resets the query cache and lets the server layout re-read cookies. */
export function hardNavigate(url: string) {
  // Intentional full reload after an auth state change (cookies + query cache must reset).
  window.location.assign(url);
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  const next = window.location.pathname + window.location.search;
  hardNavigate(`/login?next=${encodeURIComponent(next)}&expired=1`);
}

async function request<T>(method: string, path: string, body?: unknown, opts: Options = {}): Promise<T> {
  // `X-Requested-With: mj` is the CSRF marker the BFF proxy requires on every non-GET request.
  const headers: Record<string, string> = { accept: 'application/json', 'x-requested-with': 'mj' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`/api${path.startsWith('/') ? path : `/${path}`}`, { method, headers, body: payload, signal: opts.signal, credentials: 'same-origin' });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError('Ağ hatası — bağlantınızı kontrol edin', 0);
  }

  if (res.status === 401) {
    if (opts.retry !== false) {
      const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin', headers: { 'x-requested-with': 'mj' } })
        .then((r) => r.ok)
        .catch(() => false);
      if (refreshed) return request<T>(method, path, body, { ...opts, retry: false });
    }
    redirectToLogin();
    throw new ApiError('Oturum süresi doldu', 401);
  }

  const text = await res.text();
  let json: Envelope<T> | null = null;
  try {
    json = text ? (JSON.parse(text) as Envelope<T>) : null;
  } catch {
    json = null;
  }

  if (!res.ok || !json || json.success === false) {
    const message = json && 'message' in json ? json.message : res.status === 403 ? 'Bu işlem için yetkiniz yok' : `İstek başarısız (${res.status})`;
    const code = json && 'code' in json ? json.code : undefined;
    // Staff must enrol in TOTP before using admin endpoints (MFA_REQUIRED_FOR_STAFF=true).
    if (res.status === 403 && code === 'MFA_SETUP_REQUIRED') redirectToMfaSetup();
    throw new ApiError(message, json && 'statusCode' in json ? json.statusCode : res.status, code);
  }
  return json.data;
}

export const api = {
  get: <T>(path: string, opts?: Options) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: Options) => request<T>('POST', path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: Options) => request<T>('PATCH', path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: Options) => request<T>('PUT', path, body, opts),
  delete: <T>(path: string, opts?: Options) => request<T>('DELETE', path, undefined, opts),
};

/** Builds `?page=1&limit=20&q=…` from a params object, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Human readable error text for toasts. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.messages.join(' · ');
  if (e instanceof Error) return e.message;
  return 'Beklenmeyen bir hata oluştu';
}
