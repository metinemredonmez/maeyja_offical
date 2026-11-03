/**
 * Where to go after signing in: a path on this same site only, never another origin (open redirect).
 * Browsers read `\` as `/` and drop tabs and newlines, so `/\evil.com` or `/<tab>/evil.com` would leave the site;
 * the check therefore resolves the value the way a browser does and keeps it only if the origin stays ours.
 */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith('/')) return fallback;
  const base = 'https://same-origin.invalid';
  try {
    const url = new URL(next, base);
    const path = `${url.pathname}${url.search}${url.hash}`;
    // `/..//evil.com` resolves to the path `//evil.com`, which a browser would again read as another host.
    return url.origin === base && !path.startsWith('//') ? path : fallback;
  } catch {
    return fallback;
  }
}
