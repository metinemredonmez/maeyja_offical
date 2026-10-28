import { format, isThisYear, isToday } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatDateTime, formatRelative, toDate } from '@/lib/format';
import { sanitize } from '@/lib/html';
import type { MailAddress, MailMessage } from '@/lib/types';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const addressLabel = (a: MailAddress) => a.name?.trim() || a.address;
export const formatAddress = (a: MailAddress) => (a.name?.trim() ? `${a.name.trim()} <${a.address}>` : a.address);

/** "a@x.com, b@y.com c@z.com" → ['a@x.com', 'b@y.com', 'c@z.com'] (also strips `<…>` / quotes around a pasted address). */
export function splitAddresses(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((s) => s.replace(/^[<"']+|[>"']+$/g, '').trim())
    .filter(Boolean);
}

function uniqueAddresses(list: string[], exclude: string[] = []) {
  const seen = new Set(exclude.map((a) => a.toLowerCase()));
  return list.filter((a) => {
    const k = a.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** List date: relative today ("5 dakika önce"), otherwise "12 Eki" / "12 Eki 2024". */
export function mailListDate(value: string) {
  const d = toDate(value);
  if (!d) return '—';
  if (isToday(d)) return formatRelative(d);
  return format(d, isThisYear(d) ? 'd MMM' : 'd MMM yyyy', { locale: tr });
}

/** "Re: …" / "Fw: …" without stacking prefixes. */
export function prefixSubject(kind: 'Re' | 'Fw', subject: string | null) {
  const s = (subject ?? '').trim();
  // Re / Ynt (Turkish Outlook) / Aw; Fw / Fwd / İlt.
  const already = kind === 'Re' ? /^(re|ynt|aw)\s*:/i : /^(fw|fwd|[iİ]lt)\s*:/i;
  return already.test(s) ? s : `${kind}: ${s}`.trim();
}

/** Who a reply goes to. Replying to our own sent mail goes back to its recipients. */
export function replyRecipients(m: MailMessage, all: boolean, ownAddresses: string[]) {
  const own = [...ownAddresses, m.accountEmail];
  const primary = m.direction === 'OUTBOUND' ? m.to : m.replyTo.length ? m.replyTo : [m.from];
  const toAll = uniqueAddresses(primary.map((a) => a.address));
  const toOthers = uniqueAddresses(toAll, own);
  const to = toOthers.length ? toOthers : toAll;
  if (!all) return { to, cc: [] as string[] };
  const rest = m.direction === 'OUTBOUND' ? m.cc : [...m.to, ...m.cc];
  return { to, cc: uniqueAddresses(rest.map((a) => a.address), [...own, ...to]) };
}

// ───────── signature block (swapped when the sender account changes) ─────────
const SIG_START = '<!--imza-->';
const SIG_END = '<!--/imza-->';
const SIG_RE = /<!--imza-->[\s\S]*?<!--\/imza-->/;

/** Always returns the markers, even for an empty signature, so a later account switch knows where to put it. */
export const signatureBlock = (html: string | null | undefined) => `${SIG_START}${html?.trim() ? `<p></p>${html.trim()}` : ''}${SIG_END}`;
/** Replaces the signature between the markers; leaves the body alone when the user removed them. */
export const swapSignature = (body: string, block: string) => (SIG_RE.test(body) ? body.replace(SIG_RE, () => block) : body);
export const stripSignatureMarkers = (html: string) => html.split(SIG_START).join('').split(SIG_END).join('');

/** True when the HTML has visible text or an image (empty `<p></p>` + markers do not count). */
export function hasContent(html: string) {
  if (/<img\b/i.test(html)) return true;
  return (
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim() !== ''
  );
}

// ───────── quoting ─────────
/** Original body as safe, simple HTML (panel allowlist: no styles, no remote-only tricks). */
function originalBody(m: MailMessage) {
  // The allowlist keeps <img> but drops non-https src; remove the empty shells.
  if (m.html) return sanitize(m.html).replace(/<img(?![^>]*\ssrc=)[^>]*>/gi, '');
  if (m.text) return `<p>${escape(m.text).replace(/\r?\n/g, '<br>')}</p>`;
  return '';
}

export function replyQuote(m: MailMessage) {
  return `<p>${escape(formatDateTime(m.date))} tarihinde ${escape(formatAddress(m.from))} yazdı:</p>\n<blockquote>${originalBody(m)}</blockquote>`;
}

export function forwardQuote(m: MailMessage) {
  const rows: [string, string][] = [
    ['Kimden', formatAddress(m.from)],
    ['Tarih', formatDateTime(m.date)],
    ['Konu', m.subject ?? ''],
    ['Kime', m.to.map(formatAddress).join(', ')],
  ];
  if (m.cc.length) rows.push(['Bilgi', m.cc.map(formatAddress).join(', ')]);
  return `<p>---------- İletilen ileti ----------<br>${rows.map(([k, v]) => `${k}: ${escape(v)}`).join('<br>')}</p>\n${originalBody(m)}`;
}

// ───────── reader ─────────
const FRAME_CSS = [
  'html,body{margin:0;background:#fff}',
  'body{padding:16px 20px;color:#171717;font:14px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-wrap:anywhere}',
  'img{max-width:100%;height:auto}',
  'blockquote{margin:12px 0;padding-left:12px;border-left:2px solid #d4d4d4;color:#525252}',
  'pre{white-space:pre-wrap}',
  'a{color:#1d4ed8}',
].join('');

/**
 * `srcDoc` for the sandboxed reader iframe. The HTML is already sanitised server-side; the
 * sandbox (no scripts, opaque origin) is the second wall. Links open in a new tab, no referrer.
 */
export const emailDocument = (html: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="light"><base target="_blank"><style>${FRAME_CSS}</style></head><body>${html}</body></html>`;
