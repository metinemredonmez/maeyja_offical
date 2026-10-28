import { createHmac, timingSafeEqual } from 'crypto';
import { button, esc, MailContent, mailLocale, textOf } from '../notifications/mail.templates';

/**
 * Unsubscribe links carry the campaign-recipient id plus an HMAC of it — no e-mail address in the URL
 * (and so none in access logs), and nobody can unsubscribe someone else by guessing.
 */
export const unsubscribeSignature = (recipientId: string, key: Buffer) =>
  createHmac('sha256', key).update(`unsubscribe:${recipientId}`).digest('base64url').slice(0, 32);

export function verifyUnsubscribeSignature(recipientId: string, signature: string, key: Buffer): boolean {
  const expected = Buffer.from(unsubscribeSignature(recipientId, key));
  const given = Buffer.from(String(signature));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export interface CampaignContent {
  subject: string;
  preheader?: string | null;
  title?: string | null;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}

const FOOTER = {
  tr: { why: 'Bu e-postayı MAEYJA haberlerine abone olduğunuz için aldınız.', unsubscribe: 'Abonelikten çık' },
  en: { why: 'You are receiving this because you subscribed to news from MAEYJA.', unsubscribe: 'Unsubscribe' },
};

/** Same frame as the transactional emails, plus preheader, sender identity and an unsubscribe link (ETK/İYS). */
export function renderCampaign(
  c: CampaignContent,
  opts: { locale: string; unsubscribeUrl: string; webUrl: string; sender: { name: string; address: string; email: string } },
): MailContent {
  const f = FOOTER[mailLocale(opts.locale)];
  const ctaUrl = c.ctaUrl?.startsWith('/') ? `${opts.webUrl}${c.ctaUrl}` : c.ctaUrl;
  // Stored HTML is already sanitised; images only need email-safe sizing.
  const body = c.body.replace(/<img\b/gi, '<img style="max-width:100%;height:auto;display:block;margin:16px 0"') + (ctaUrl && c.ctaLabel ? button(ctaUrl, c.ctaLabel) : '');
  const sender = [opts.sender.name, opts.sender.address, opts.sender.email].filter(Boolean).map(esc).join(' · ');
  const html = `<!doctype html><html><body style="margin:0;background:#F6F4F0;font-family:Helvetica,Arial,sans-serif;color:#1A1A1A">
${c.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(c.preheader)}</div>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF">
<tr><td style="padding:36px 40px 12px;text-align:center;letter-spacing:.42em;font-size:18px">MAEYJA</td></tr>
${c.title ? `<tr><td style="padding:12px 40px 8px;font-size:20px;font-weight:400">${esc(c.title)}</td></tr>` : ''}
<tr><td style="padding:8px 40px 36px;font-size:14px;line-height:1.7;color:#3A3A3A">${body}</td></tr>
</table>
<p style="font-size:11px;line-height:1.7;color:#8A8A8A;max-width:560px;margin:24px auto 0">${esc(f.why)} <a href="${esc(opts.unsubscribeUrl)}" style="color:#8A8A8A">${esc(f.unsubscribe)}</a><br>${sender}</p>
</td></tr></table></body></html>`;
  return { subject: c.subject, html, text: `${c.title ? `${c.title}\n\n` : ''}${textOf(body)}${ctaUrl ? `\n\n${ctaUrl}` : ''}\n\n${f.unsubscribe}: ${opts.unsubscribeUrl}` };
}
