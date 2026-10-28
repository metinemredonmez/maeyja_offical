'use client';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Envelope<T> = { success: boolean; data: T; message?: string | string[]; statusCode?: number };

/** Browser → `/api/*` (same origin). The BFF proxy adds the tokens. */
async function request<T>(method: string, path: string, body?: unknown, locale?: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'X-Requested-With': 'mj', // CSRF marker checked by the BFF proxy
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(locale ? { 'Accept-Language': locale } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !json?.success) {
    const msg = json?.message;
    throw new ApiError(Array.isArray(msg) ? msg.join('\n') : (msg ?? `Hata ${res.status}`), res.status, json);
  }
  return json.data;
}

export const api = {
  get: <T>(path: string, locale?: string) => request<T>('GET', path, undefined, locale),
  post: <T>(path: string, body?: unknown, locale?: string) => request<T>('POST', path, body ?? {}, locale),
  patch: <T>(path: string, body?: unknown, locale?: string) => request<T>('PATCH', path, body ?? {}, locale),
  delete: <T>(path: string, locale?: string) => request<T>('DELETE', path, undefined, locale),
};
