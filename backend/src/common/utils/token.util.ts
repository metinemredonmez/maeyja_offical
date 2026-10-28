import { createHash, randomBytes } from 'crypto';

/** Opaque random token for links/refresh tokens; only its hash is stored. */
export const generateToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
