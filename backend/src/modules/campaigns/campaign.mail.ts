import { createHmac, timingSafeEqual } from 'crypto';
import { button, emailShell, esc, MailContent, mailLocale, textOf } from '../notifications/mail.templates';

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
  imageUrl?: string | null;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}

const FOOTER = {
  tr: { why: 'Bu e-postayı MAEYJA haberlerine abone olduğunuz için aldınız.', unsubscribe: 'Abonelikten çık' },
  en: { why: 'You are receiving this because you subscribed to news from MAEYJA.', unsubscribe: 'Unsubscribe' },
};

/** The shared MAEYJA frame (emailShell) with a cover image, sender identity and an unsubscribe link (ETK/İYS). */
export function renderCampaign(
  c: CampaignContent,
  opts: { locale: string; unsubscribeUrl: string; webUrl: string; sender: { name: string; address: string; email: string } },
): MailContent {
  const locale = mailLocale(opts.locale);
  const f = FOOTER[locale];
  const ctaUrl = c.ctaUrl?.startsWith('/') ? `${opts.webUrl}${c.ctaUrl}` : c.ctaUrl;
  // Stored HTML is already sanitised; images only need email-safe sizing.
  const body = c.body.replace(/<img\b/gi, '<img style="max-width:100%;height:auto;display:block;margin:24px 0"') + (ctaUrl && c.ctaLabel ? button(ctaUrl, c.ctaLabel) : '');
  const sender = [opts.sender.name, opts.sender.address, opts.sender.email].filter(Boolean).map(esc).join(' · ');
  const html = emailShell({
    locale,
    title: c.title,
    bodyHtml: body,
    preheader: c.preheader,
    heroImageUrl: c.imageUrl,
    heroAlt: c.title ?? c.subject,
    footerHtml: `${esc(f.why)} <a href="${esc(opts.unsubscribeUrl)}" style="color:#8C877F">${esc(f.unsubscribe)}</a><br>${sender}`,
  });
  return { subject: c.subject, html, text: `${c.title ? `${c.title}\n\n` : ''}${textOf(body)}${ctaUrl ? `\n\n${ctaUrl}` : ''}\n\n${f.unsubscribe}: ${opts.unsubscribeUrl}` };
}
