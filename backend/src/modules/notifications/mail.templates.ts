/**
 * Minimal, brand-consistent transactional emails (TR/EN).
 * Inline styles only — email clients ignore <style> blocks unpredictably.
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

function layout(title: string, bodyHtml: string, footer = 'MAEYJA — Hand crafted elegance.'): string {
  return `<!doctype html><html><body style="margin:0;background:#F6F4F0;font-family:Helvetica,Arial,sans-serif;color:#1A1A1A">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF">
<tr><td style="padding:36px 40px 12px;text-align:center;letter-spacing:.42em;font-size:18px">MAEYJA</td></tr>
<tr><td style="padding:12px 40px 8px;font-size:20px;font-weight:400">${esc(title)}</td></tr>
<tr><td style="padding:8px 40px 36px;font-size:14px;line-height:1.7;color:#3A3A3A">${bodyHtml}</td></tr>
</table>
<p style="font-size:11px;color:#8A8A8A;letter-spacing:.08em;margin-top:24px">${esc(footer)}</p>
</td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:28px 0"><a href="${esc(href)}" style="background:#1A1A1A;color:#FFFFFF;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:.16em;text-transform:uppercase">${esc(label)}</a></p>`;

const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function build(subject: string, title: string, body: string): MailContent {
  const html = layout(title, body);
  return { subject, html, text: textOf(body) };
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
      : build('Welcome to MAEYJA', `Welcome${firstName ? `, ${firstName}` : ''}`, `<p>Your account is ready. Discover pieces handcrafted in Istanbul.</p>${button(shopUrl, 'Discover the collection')}`),

  verifyEmail: (l: MailLocale, link: string) =>
    l === 'tr'
      ? build('E-posta adresinizi doğrulayın', 'E-posta doğrulama', `<p>Hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın. Bağlantı 48 saat geçerlidir.</p>${button(link, 'Doğrula')}`)
      : build('Verify your email', 'Verify your email', `<p>Click below to verify your account. The link is valid for 48 hours.</p>${button(link, 'Verify')}`),

  passwordReset: (l: MailLocale, link: string) =>
    l === 'tr'
      ? build('Şifre sıfırlama', 'Şifrenizi sıfırlayın', `<p>Şifre sıfırlama talebi aldık. Bağlantı 1 saat geçerlidir. Talebi siz yapmadıysanız bu e-postayı yok sayın.</p>${button(link, 'Yeni şifre belirle')}`)
      : build('Reset your password', 'Reset your password', `<p>We received a password reset request. The link is valid for 1 hour. If this wasn't you, ignore this email.</p>${button(link, 'Set a new password')}`),

  orderReceived: (l: MailLocale, o: OrderMailData) => {
    const bank = o.bankTransfer
      ? `<div style="background:#F6F4F0;padding:16px;margin:16px 0;font-size:13px">${l === 'tr' ? '<b>Havale / EFT bilgileri</b>' : '<b>Bank transfer details</b>'}<br>${esc(o.bankTransfer.bankName)}<br>${esc(o.bankTransfer.accountName)}<br>IBAN: ${esc(o.bankTransfer.iban)}<br><i>${esc(o.bankTransfer.note)}</i></div>`
      : '';
    return l === 'tr'
      ? build(`Siparişiniz alındı — ${o.orderNumber}`, `Teşekkürler${o.firstName ? `, ${o.firstName}` : ''}`, `<p>${esc(o.orderNumber)} numaralı siparişiniz ${o.bankTransfer ? 'ödemenizi bekliyor' : 'onaylandı ve hazırlanıyor'}.</p>${bank}${itemsTable(o, l)}${button(o.orderUrl, 'Siparişi görüntüle')}`)
      : build(`Order received — ${o.orderNumber}`, `Thank you${o.firstName ? `, ${o.firstName}` : ''}`, `<p>Your order ${esc(o.orderNumber)} ${o.bankTransfer ? 'is awaiting payment' : 'is confirmed and being prepared'}.</p>${bank}${itemsTable(o, l)}${button(o.orderUrl, 'View order')}`);
  },

  paymentConfirmed: (l: MailLocale, o: OrderMailData) =>
    l === 'tr'
      ? build(`Ödemeniz onaylandı — ${o.orderNumber}`, 'Ödemeniz alındı', `<p>${esc(o.orderNumber)} numaralı siparişinizin ödemesi onaylandı; siparişiniz hazırlanıyor.</p>${itemsTable(o, l)}${button(o.orderUrl, 'Siparişi görüntüle')}`)
      : build(`Payment confirmed — ${o.orderNumber}`, 'Payment received', `<p>Payment for order ${esc(o.orderNumber)} is confirmed and your order is being prepared.</p>${itemsTable(o, l)}${button(o.orderUrl, 'View order')}`),

  orderShipped: (l: MailLocale, o: OrderMailData) => {
    const track = o.trackingUrl ? button(o.trackingUrl, l === 'tr' ? 'Kargoyu takip et' : 'Track shipment') : '';
    return l === 'tr'
      ? build(`Siparişiniz yola çıktı — ${o.orderNumber}`, 'Siparişiniz kargoda', `<p>${esc(o.carrier ?? '')} ${o.trackingNumber ? `takip no: <b>${esc(o.trackingNumber)}</b>` : ''}</p>${track}`)
      : build(`Your order has shipped — ${o.orderNumber}`, 'On its way', `<p>${esc(o.carrier ?? '')} ${o.trackingNumber ? `tracking: <b>${esc(o.trackingNumber)}</b>` : ''}</p>${track}`);
  },

  orderCancelled: (l: MailLocale, o: OrderMailData) =>
    l === 'tr'
      ? build(`Siparişiniz iptal edildi — ${o.orderNumber}`, 'Sipariş iptali', `<p>${esc(o.orderNumber)} numaralı siparişiniz iptal edildi. Ödeme alındıysa iadesi bankanıza bağlı olarak 3–10 iş günü içinde hesabınıza yansır.</p>`)
      : build(`Order cancelled — ${o.orderNumber}`, 'Order cancelled', `<p>Your order ${esc(o.orderNumber)} was cancelled. Any payment will be refunded within 3–10 business days.</p>`),

  stockAlert: (l: MailLocale, productName: string, link: string) =>
    l === 'tr'
      ? build(`${productName} yeniden stokta`, 'Beklediğiniz parça geri döndü', `<p>${esc(productName)} yeniden stokta. Adetler sınırlı.</p>${button(link, 'Hemen incele')}`)
      : build(`${productName} is back in stock`, 'It’s back', `<p>${esc(productName)} is back in stock. Quantities are limited.</p>${button(link, 'Shop now')}`),

  returnUpdate: (l: MailLocale, orderNumber: string, status: string) =>
    l === 'tr'
      ? build(`İade talebiniz güncellendi — ${orderNumber}`, 'İade talebi', `<p>${esc(orderNumber)} siparişine ait iade talebinizin durumu: <b>${esc(status)}</b>.</p>`)
      : build(`Your return was updated — ${orderNumber}`, 'Return request', `<p>Status of your return for ${esc(orderNumber)}: <b>${esc(status)}</b>.</p>`),

  adminNewOrder: (o: OrderMailData, provider: string) =>
    build(`Yeni sipariş: ${o.orderNumber} (${money(o.total, 'tr')})`, 'Yeni sipariş', `<p>Ödeme yöntemi: ${esc(provider)}</p>${itemsTable(o, 'tr')}${button(o.orderUrl, 'Admin’de aç')}`),

  adminNotice: (subject: string, lines: Record<string, unknown>) =>
    build(subject, subject, Object.entries(lines).map(([k, v]) => `<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join('')),
};
