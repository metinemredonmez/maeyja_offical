/** Zero-width, bidi and other invisible characters, plus control characters. */
const INVISIBLE = /[\p{Default_Ignorable_Code_Point}\p{Cc}]/gu;

/**
 * PRS-01: the one form an e-mail address is stored and looked up in (sign-up, sign-in, reset, staff, newsletter,
 * orders). NFKC folds full-width and compatibility characters, invisible characters are dropped, and the Turkish
 * capital "İ" becomes a plain "i" (`toLowerCase` would give "i" + a combining dot).
 */
export function normalizeEmail(value: string): string {
  return value.replace(INVISIBLE, '').normalize('NFKC').replace(/İ/g, 'i').toLowerCase().trim();
}

/** class-transformer `@Transform` for e-mail fields. */
export const emailTransform = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeEmail(value) : value);
