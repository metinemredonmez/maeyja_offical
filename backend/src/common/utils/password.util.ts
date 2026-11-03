import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';

/** PWD-04: OWASP's Argon2id baseline (19 MiB, t=2, p=1). */
const ARGON2 = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** PWD-02: one Unicode form before hashing, so the same password typed on another keyboard still matches. */
const normalize = (password: string) => password.normalize('NFKC');

export const hashPassword = (password: string) => argon2.hash(normalize(password), ARGON2);

let dummy: Promise<string> | undefined;
/** Real hash, so a sign-in for an unknown address costs the same as one for a real account. */
export const dummyHash = () => (dummy ??= hashPassword('maeyja-timing-guard'));

/**
 * Checks a password against a stored hash. `rehash` is set when the stored hash is an old bcrypt one (or weaker
 * Argon2 parameters) and the password was right: the caller saves it so the account moves to Argon2id on sign-in.
 */
export async function verifyPassword(hash: string | null | undefined, password: string): Promise<{ ok: boolean; rehash?: string }> {
  if (!hash) {
    await argon2.verify(await dummyHash(), normalize(password)).catch(() => false);
    return { ok: false };
  }
  if (hash.startsWith('$2')) {
    // bcrypt hashes were made from the raw string and cut at 72 bytes.
    const ok = await bcrypt.compare(password, hash);
    return ok ? { ok, rehash: await hashPassword(password) } : { ok };
  }
  const ok = await argon2.verify(hash, normalize(password)).catch(() => false);
  if (!ok) return { ok };
  return argon2.needsRehash(hash, ARGON2) ? { ok, rehash: await hashPassword(password) } : { ok };
}
