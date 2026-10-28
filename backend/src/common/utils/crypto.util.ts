import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** AES-256-GCM for small secrets at rest (TOTP seeds). Output: base64(iv | tag | ciphertext). */
export function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

export function decrypt(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** 32-byte key from APP_ENCRYPTION_KEY (base64) or derived from the JWT secret. */
export function keyFromEnv(encryptionKey: string, fallbackSecret: string): Buffer {
  if (encryptionKey) {
    const k = Buffer.from(encryptionKey, 'base64');
    if (k.length === 32) return k;
  }
  return createHash('sha256').update(`maeyja-enc:${fallbackSecret}`).digest();
}
