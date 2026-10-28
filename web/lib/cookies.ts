/** Cookie names shared by the BFF proxy and server components. Values never reach browser JS. */
export const COOKIE = {
  access: 'mj_at',
  refresh: 'mj_rt',
  cart: 'mj_cart',
} as const;

const secure = process.env.NODE_ENV === 'production';

export const cookieOptions = {
  access: { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: 60 * 15 },
  refresh: { httpOnly: true, secure, sameSite: 'strict' as const, path: '/api/auth', maxAge: 60 * 60 * 24 * 30 },
  cart: { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 },
};
