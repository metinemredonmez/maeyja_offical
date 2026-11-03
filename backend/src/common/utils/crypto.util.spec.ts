import { randomBytes } from 'crypto';
import { decrypt, encrypt, keyFromEnv } from './crypto.util';

describe('keyFromEnv (KEY-01)', () => {
  const good = randomBytes(32).toString('base64');

  it('uses a 32-byte key as it is', () => {
    expect(keyFromEnv(good, 'jwt', true)).toEqual(Buffer.from(good, 'base64'));
    expect(decrypt(encrypt('secret', keyFromEnv(good, 'jwt', true)), keyFromEnv(good, 'jwt', true))).toBe('secret');
  });

  it('refuses a missing or wrong-length key in production', () => {
    expect(() => keyFromEnv('', 'jwt', true)).toThrow(/32 bytes/);
    expect(() => keyFromEnv(randomBytes(24).toString('base64'), 'jwt', true)).toThrow(/32 bytes/);
  });

  it('still falls back in development', () => {
    expect(keyFromEnv('', 'jwt', false)).toHaveLength(32);
  });
});
