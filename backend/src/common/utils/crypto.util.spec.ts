import { decrypt, encrypt, keyFromEnv } from './crypto.util';

describe('crypto.util', () => {
  const key = keyFromEnv('', 'some-jwt-secret-that-is-long-enough-123456');

  it('round-trips and never repeats ciphertext', () => {
    const a = encrypt('JBSWY3DPEHPK3PXP', key);
    const b = encrypt('JBSWY3DPEHPK3PXP', key);
    expect(a).not.toBe(b);
    expect(decrypt(a, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('rejects tampered payloads', () => {
    const enc = Buffer.from(encrypt('secret', key), 'base64');
    enc[enc.length - 1] ^= 0xff;
    expect(() => decrypt(enc.toString('base64'), key)).toThrow();
  });

  it('prefers a real 32-byte key over the derived one', () => {
    const real = Buffer.alloc(32, 7).toString('base64');
    expect(keyFromEnv(real, 'x')).toEqual(Buffer.alloc(32, 7));
    expect(keyFromEnv('short', 'x')).toHaveLength(32);
  });
});
