/**
 * Brand emails (TR/EN): one editorial shell for transactional mail and campaigns.
 * Table layout + inline styles for old clients; the small <style> block only adds mobile padding
 * and is safely ignored where unsupported. Fonts fall back to Georgia / Helvetica (Gmail strips web fonts).
 */
export type MailLocale = 'tr' | 'en';

/** Transactional emails exist in Turkish and English; every other storefront language gets English. */
export const mailLocale = (locale: string | null | undefined): MailLocale => (locale === 'tr' ? 'tr' : 'en');

export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const money = (n: number, locale: MailLocale) =>
  new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { style: 'currency', currency: 'TRY' }).format(n);

const INK = '#1A1A1A';
const TEXT = '#4A4743';
const MUTED = '#8C877F';
const LINE = '#ECE8E1';
const GROUND = '#F6F4F0';
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
const INSTAGRAM = 'https://www.instagram.com/maeyja_official/';

const siteUrl = () => (process.env.WEB_URL || 'https://maeyja.com').replace(/\/$/, '');

const NAV: Record<MailLocale, [string, string][]> = {
  tr: [['Çantalar', '/products'], ['Atölye', '/about'], ['Journal', '/journal']],
  en: [['Bags', '/en/products'], ['Atelier', '/en/about'], ['Journal', '/en/journal']],
};

const rule = `<div style="height:1px;line-height:1px;font-size:0;background:${LINE}">&nbsp;</div>`;

export interface ShellOptions {
  locale: MailLocale;
  title?: string | null;
  /** Already-safe HTML (escaped text or sanitised CMS HTML). */
  bodyHtml: string;
  /** Inbox preview line next to the subject. */
  preheader?: string | null;
  /** Full-width image under the logo (campaigns). */
  heroImageUrl?: string | null;
  heroAlt?: string;
  /** Already-safe HTML shown in small print under the card. */
  footerHtml?: string;
}

/** The one MAEYJA email frame: logo, optional hero, serif title, body, quiet footer navigation. */
export function emailShell(o: ShellOptions): string {
  const site = siteUrl();
  const nav = [...NAV[o.locale].map(([label, path]) => [label, `${site}${path}`]), ['Instagram', INSTAGRAM]]
    .map(([label, href]) => `<a href="${esc(href)}" style="color:${INK};text-decoration:none">${esc(label)}</a>`)
    .join(`<span style="color:${LINE}">&nbsp;&nbsp;·&nbsp;&nbsp;</span>`);
  const footer = o.footerHtml ?? `Hand crafted elegance.<br>MAEYJA · İstanbul, Türkiye`;
  return `<!doctype html>
<html lang="${o.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(o.title || 'MAEYJA')}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap" rel="stylesheet">
<style>
@media (max-width:620px){.mj-pad{padding-left:24px!important;padding-right:24px!important}.mj-title{font-size:28px!important}.mj-outer{padding:0!important}}
.mj-body p{margin:0 0 16px}.mj-body a{color:${INK}}
</style></head>
<body style="margin:0;padding:0;background:${GROUND};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
${o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${esc(o.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${GROUND}"><tr><td class="mj-outer" align="center" style="padding:40px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF">
<tr><td align="center" style="padding:46px 24px 38px"><a href="${esc(site)}" style="font-family:${SANS};font-size:15px;letter-spacing:.55em;padding-left:.55em;color:${INK};text-decoration:none">MAEYJA</a></td></tr>
${
  o.heroImageUrl
    ? `<tr><td style="padding:0;font-size:0;line-height:0"><img src="${esc(o.heroImageUrl)}" width="600" alt="${esc(o.heroAlt ?? '')}" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none"></td></tr>`
    : `<tr><td class="mj-pad" style="padding:0 56px">${rule}</td></tr>`
}
<tr><td class="mj-pad mj-body" style="padding:48px 56px 8px;font-family:${SANS};font-size:15px;line-height:1.75;color:${TEXT}">
${o.title ? `<h1 class="mj-title" style="margin:0 0 24px;font-family:${SERIF};font-weight:300;font-size:34px;line-height:1.15;letter-spacing:-.01em;color:${INK}">${esc(o.title)}</h1>` : ''}
${o.bodyHtml}
</td></tr>
<tr><td class="mj-pad" style="padding:40px 56px 46px">${rule}
<p style="margin:28px 0 0;text-align:center;font-family:${SANS};font-size:10px;line-height:2;letter-spacing:.24em;text-transform:uppercase">${nav}</p>
</td></tr>
</table>
<p style="max-width:600px;margin:26px auto 0;padding:0 16px;font-family:${SANS};font-size:11px;line-height:1.8;color:${MUTED};text-align:center">${footer}</p>
</td></tr></table>
</body></html>`;
}

/** Solid ink button; a table so Outlook keeps the padding. */
export const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:36px 0 8px"><tr><td style="background:${INK}"><a href="${esc(href)}" style="display:inline-block;padding:17px 40px;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:#FFFFFF;text-decoration:none">${esc(label)}</a></td></tr></table>`;

export const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function build(subject: string, title: string, body: string, locale: MailLocale = 'tr'): MailContent {
  return { subject, html: emailShell({ locale, title, bodyHtml: body, preheader: textOf(body).slice(0, 120) }), text: `${title}\n\n${textOf(body)}` };
}

export interface OrderMailData {
  orderNumber: string;
  firstName?: string | null;
  total: number;
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  items: { productName: string; variantName?: string | null; quantity: number; lineTotal: number }[];
  orderUrl: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  bankTransfer?: { bankName: string; accountName: string; iban: string; note: string } | null;
}

function itemsTable(o: OrderMailData, l: MailLocale): string {
  const rows = o.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #EEE">${esc(i.productName)}${i.variantName ? ` — ${esc(i.variantName)}` : ''} × ${i.quantity}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #EEE">${money(i.lineTotal, l)}</td></tr>`,
    )
    .join('');
  const t = l === 'tr' ? { sub: 'Ara toplam', ship: 'Kargo', disc: 'İndirim', total: 'Toplam' } : { sub: 'Subtotal', ship: 'Shipping', disc: 'Discount', total: 'Total' };
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin:16px 0">${rows}
<tr><td style="padding-top:12px">${t.sub}</td><td align="right" style="padding-top:12px">${money(o.subtotal, l)}</td></tr>
${o.discountTotal > 0 ? `<tr><td>${t.disc}</td><td align="right">−${money(o.discountTotal, l)}</td></tr>` : ''}
<tr><td>${t.ship}</td><td align="right">${o.shippingTotal > 0 ? money(o.shippingTotal, l) : l === 'tr' ? 'Ücretsiz' : 'Free'}</td></tr>
<tr><td style="padding-top:8px;font-weight:bold">${t.total}</td><td align="right" style="padding-top:8px;font-weight:bold">${money(o.total, l)}</td></tr></table>`;
}

export const templates = {
  welcome: (l: MailLocale, firstName: string | null | undefined, shopUrl: string) =>
    l === 'tr'
      ? build('MAEYJA’ya hoş geldiniz', `Hoş geldiniz${firstName ? `, ${firstName}` : ''}`, `<p>Hesabınız oluşturuldu. Elde, İstanbul’da üretilen parçalarımızı keşfedin.</p>${button(shopUrl, 'Koleksiyonu keşfet')}`)
      : build('Welcome to MAEYJA', `Welcome${firstName ? `, ${firstName}` : ''}`, `<p>Your account is ready. Discover pieces handcrafted in Istanbul.</p>${button(shopUrl, 'Discover the collection')}`, 'en'),

  verifyEmail: (l: MailLocale, link: string) =>
    l === 'tr'
      ? build('E-posta adresinizi doğrulayın', 'E-posta doğrulama', `<p>Hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın. Bağlantı 48 saat geçerlidir.</p>${button(link, 'Doğrula')}`)
      : build('Verify your email', 'Verify your email', `<p>Click below to verify your account. The link is valid for 48 hours.</p>${button(link, 'Verify')}`, 'en'),

  passwordReset: (l: MailLocale, link: string) =>
    l === 'tr'
      ? build('Şifre sıfırlama', 'Şifrenizi sıfırlayın', `<p>Şifre sıfırlama talebi aldık. Bağlantı 1 saat geçerlidir. Talebi siz yapmadıysanız bu e-postayı yok sayın.</p>${button(link, 'Yeni şifre belirle')}`)
      : build('Reset your password', 'Reset your password', `<p>We received a password reset request. The link is valid for 1 hour. If this wasn't you, ignore this email.</p>${button(link, 'Set a new password')}`, 'en'),

  orderReceived: (l: MailLocale, o: OrderMailData) => {
    const bank = o.bankTransfer
      ? `<div style="background:#F6F4F0;padding:16px;margin:16px 0;font-size:13px">${l === 'tr' ? '<b>Havale / EFT bilgileri</b>' : '<b>Bank transfer details</b>'}<br>${esc(o.bankTransfer.bankName)}<br>${esc(o.bankTransfer.accountName)}<br>IBAN: ${esc(o.bankTransfer.iban)}<br><i>${esc(o.bankTransfer.note)}</i></div>`
      : '';
    return l === 'tr'
      ? build(`Siparişiniz alındı — ${o.orderNumber}`, `Teşekkürler${o.firstName ? `, ${o.firstName}` : ''}`, `<p>${esc(o.orderNumber)} numaralı siparişiniz ${o.bankTransfer ? 'ödemenizi bekliyor' : 'onaylandı ve hazırlanıyor'}.</p>${bank}${itemsTable(o, l)}${button(o.orderUrl, 'Siparişi görüntüle')}`)
      : build(`Order received — ${o.orderNumber}`, `Thank you${o.firstName ? `, ${o.firstName}` : ''}`, `<p>Your order ${esc(o.orderNumber)} ${o.bankTransfer ? 'is awaiting payment' : 'is confirmed and being prepared'}.</p>${bank}${itemsTable(o, l)}${button(o.orderUrl, 'View order')}`, 'en');
  },

  paymentConfirmed: (l: MailLocale, o: OrderMailData) =>
    l === 'tr'
      ? build(`Ödemeniz onaylandı — ${o.orderNumber}`, 'Ödemeniz alındı', `<p>${esc(o.orderNumber)} numaralı siparişinizin ödemesi onaylandı; siparişiniz hazırlanıyor.</p>${itemsTable(o, l)}${button(o.orderUrl, 'Siparişi görüntüle')}`)
      : build(`Payment confirmed — ${o.orderNumber}`, 'Payment received', `<p>Payment for order ${esc(o.orderNumber)} is confirmed and your order is being prepared.</p>${itemsTable(o, l)}${button(o.orderUrl, 'View order')}`, 'en'),

  orderShipped: (l: MailLocale, o: OrderMailData) => {
    const track = o.trackingUrl ? button(o.trackingUrl, l === 'tr' ? 'Kargoyu takip et' : 'Track shipment') : '';
    return l === 'tr'
      ? build(`Siparişiniz yola çıktı — ${o.orderNumber}`, 'Siparişiniz kargoda', `<p>${esc(o.carrier ?? '')} ${o.trackingNumber ? `takip no: <b>${esc(o.trackingNumber)}</b>` : ''}</p>${track}`)
      : build(`Your order has shipped — ${o.orderNumber}`, 'On its way', `<p>${esc(o.carrier ?? '')} ${o.trackingNumber ? `tracking: <b>${esc(o.trackingNumber)}</b>` : ''}</p>${track}`, 'en');
  },

  orderCancelled: (l: MailLocale, o: OrderMailData) =>
    l === 'tr'
      ? build(`Siparişiniz iptal edildi — ${o.orderNumber}`, 'Sipariş iptali', `<p>${esc(o.orderNumber)} numaralı siparişiniz iptal edildi. Ödeme alındıysa iadesi bankanıza bağlı olarak 3–10 iş günü içinde hesabınıza yansır.</p>`)
      : build(`Order cancelled — ${o.orderNumber}`, 'Order cancelled', `<p>Your order ${esc(o.orderNumber)} was cancelled. Any payment will be refunded within 3–10 business days.</p>`, 'en'),

  stockAlert: (l: MailLocale, productName: string, link: string) =>
    l === 'tr'
      ? build(`${productName} yeniden stokta`, 'Beklediğiniz parça geri döndü', `<p>${esc(productName)} yeniden stokta. Adetler sınırlı.</p>${button(link, 'Hemen incele')}`)
      : build(`${productName} is back in stock`, 'It’s back', `<p>${esc(productName)} is back in stock. Quantities are limited.</p>${button(link, 'Shop now')}`, 'en'),

  returnUpdate: (l: MailLocale, orderNumber: string, status: string) =>
    l === 'tr'
      ? build(`İade talebiniz güncellendi — ${orderNumber}`, 'İade talebi', `<p>${esc(orderNumber)} siparişine ait iade talebinizin durumu: <b>${esc(status)}</b>.</p>`)
      : build(`Your return was updated — ${orderNumber}`, 'Return request', `<p>Status of your return for ${esc(orderNumber)}: <b>${esc(status)}</b>.</p>`, 'en'),

  adminNewOrder: (o: OrderMailData, provider: string) =>
    build(`Yeni sipariş: ${o.orderNumber} (${money(o.total, 'tr')})`, 'Yeni sipariş', `<p>Ödeme yöntemi: ${esc(provider)}</p>${itemsTable(o, 'tr')}${button(o.orderUrl, 'Admin’de aç')}`),

  adminNotice: (subject: string, lines: Record<string, unknown>) =>
    build(subject, subject, Object.entries(lines).map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join('')),
};
