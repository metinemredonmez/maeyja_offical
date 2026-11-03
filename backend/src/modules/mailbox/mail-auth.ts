/**
 * AI-01: was the From address really vouched for? Only the topmost Authentication-Results header counts (our own
 * receiving server adds it on top; anything below could come from the sender). The From domain passes when DMARC
 * passed for it, or a passing DKIM signature belongs to it (relaxed alignment: same domain or a subdomain).
 */
export function senderVerified(headerLines: readonly { key: string; line: string }[], fromAddress: string): boolean {
  const top = headerLines.find((h) => h.key.toLowerCase() === 'authentication-results');
  const domain = fromAddress.split('@')[1]?.toLowerCase();
  if (!top || !domain) return false;
  const aligned = (d: string | undefined) => {
    const x = d?.replace(/^@/, '').split('@').pop()?.toLowerCase();
    return Boolean(x) && (x === domain || domain.endsWith(`.${x}`) || x!.endsWith(`.${domain}`));
  };
  const body = top.line
    .replace(/^[^:]*:/, '')
    .replace(/\s+/g, ' ')
    .replace(/\([^()]*\)/g, '');
  for (const part of body.split(';').slice(1)) {
    const m = /^\s*(dkim|dmarc)\s*=\s*(\w+)/i.exec(part);
    if (!m || m[2].toLowerCase() !== 'pass') continue;
    const prop = (name: string) => new RegExp(`${name.replace('.', '\\.')}\\s*=\\s*"?([^\\s";]+)`, 'i').exec(part)?.[1];
    if (m[1].toLowerCase() === 'dmarc' && aligned(prop('header.from') ?? domain)) return true;
    if (m[1].toLowerCase() === 'dkim' && aligned(prop('header.d') ?? prop('header.i'))) return true;
  }
  return false;
}
