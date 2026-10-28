/**
 * Cookie names and options shared by the BFF proxy and `proxy.ts`.
 * Tokens never reach browser JavaScript: both cookies are httpOnly, SameSite=Strict
 * (the admin never needs cross-site navigation).
 */
export const ACCESS_COOKIE = 'mj_at';
export const REFRESH_COOKIE = 'mj_rt';

const secure = process.env.NODE_ENV === 'production';

/**
 * Access cookie. The JWT inside is valid for 15 minutes (backend-enforced); the cookie
 * itself lives as long as the refresh token so that `proxy.ts` can tell "session exists,
 * token stale" apart from "never signed in" — the API client refreshes on the first 401.
 */
export const accessCookieOptions = {
  httpOnly: true,
  secure,
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
};

/** Refresh cookie: 30 days, only ever sent to `/api/auth/*`. */
export const refreshCookieOptions = {
  httpOnly: true,
  secure,
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 30 * 24 * 60 * 60,
};
