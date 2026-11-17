import { storefrontPath } from '../../common/utils/i18n.util';
import { esc, MailContent, mailLocale } from '../notifications/mail.templates';
import { renderCampaign } from './campaign.mail';

export const FLOWS = ['welcome', 'afterPurchase', 'winback'] as const;
/** Unsubscribe links of automatic e-mails carry `a_` + the send's id (campaign links carry the recipient's id). */
export const AUTOMATION_PREFIX = 'a_';
export type Flow = (typeof FLOWS)[number];
/** The setting that holds each flow (Admin → Otomatik e-postalar). */
export const FLOW_SETTING = { welcome: 'mailWelcome', afterPurchase: 'mailAfterPurchase', winback: 'mailWinback' } as const;

/** The button under each e-mail: where the reader goes next. */
const CTA: Record<Flow, { path: string; label: { tr: string; en: string } }> = {
  welcome: { path: '/products', label: { tr: 'Koleksiyonu keşfedin', en: 'Discover the collection' } },
  afterPurchase: { path: '/care', label: { tr: 'Bakım rehberi', en: 'Care guide' } },
  winback: { path: '/products', label: { tr: 'Yeni modeller', en: 'New models' } },
};

/**
 * The admin's plain text with its placeholders filled: {name} becomes " Ad" (so "Merhaba{name}," reads well with or
 * without a name), {coupon} the code; a paragraph whose {coupon} has no code is left out. Every word is escaped.
 */
export function fillBody(text: string, vars: { name?: string | null; coupon?: string | null }): string {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !(p.includes('{coupon}') && !vars.coupon))
    .map((p) => p.replaceAll('{name}', vars.name?.trim() ? ` ${vars.name.trim()}` : '').replaceAll('{coupon}', vars.coupon ?? ''))
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function renderAutomation(
  flow: Flow,
  texts: { subject: Record<string, string>; body: Record<string, string> },
  vars: { name?: string | null; coupon?: string | null },
  opts: { locale: string; unsubscribeUrl: string; webUrl: string; sender: { name: string; address: string; email: string } },
): MailContent {
  const l = mailLocale(opts.locale);
  // The admin may have filled only Turkish (or only English): use whichever exists.
  const subject = (texts.subject[l] || texts.subject.en || texts.subject.tr || 'MAEYJA').replaceAll('{name}', vars.name?.trim() ? ` ${vars.name.trim()}` : '').trim();
  const body = fillBody(texts.body[l] || texts.body.en || texts.body.tr || '', vars);
  const cta = CTA[flow];
  return renderCampaign(
    { subject, title: subject, body, ctaLabel: cta.label[l], ctaUrl: storefrontPath(opts.locale, cta.path) },
    { locale: opts.locale, unsubscribeUrl: opts.unsubscribeUrl, webUrl: opts.webUrl, sender: opts.sender },
  );
}
