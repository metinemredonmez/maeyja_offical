/**
 * Every alert the API can raise (LOG-04). INFO stays in the panel; WARNING and CRITICAL also go out by e-mail (and
 * the chat webhook, if one is set), at most once per `repeatMin` while the same problem stays open.
 */
export const ALERT_CATALOG = {
  'payment.review': { level: 'WARNING', group: 'Ödeme', title: 'Ödeme incelemede', repeatMin: 60 },
  'payment.needs_refund': { level: 'CRITICAL', group: 'Ödeme', title: 'İptal edilmiş siparişe ödeme geldi, iade gerekli', repeatMin: 60 },
  'payment.duplicate_refunded': { level: 'WARNING', group: 'Ödeme', title: 'Çift ödeme otomatik iade edildi', repeatMin: 60 },
  'payment.refund_failed': { level: 'CRITICAL', group: 'Ödeme', title: 'Çift ödeme iade edilemedi', repeatMin: 60 },
  'payment.provider_auth': { level: 'CRITICAL', group: 'Ödeme', title: 'Kart sağlayıcısı anahtarı reddedildi', repeatMin: 60 },
  'payment.provider_down': { level: 'WARNING', group: 'Ödeme', title: 'Kart sağlayıcısına ulaşılamıyor', repeatMin: 30 },
  'payment.webhook_failed': { level: 'CRITICAL', group: 'Ödeme', title: 'Stripe bildirimi işlenemedi', repeatMin: 30 },
  'payment.webhook_signature': { level: 'WARNING', group: 'Ödeme', title: 'İmzası geçersiz Stripe bildirimi geldi', repeatMin: 360 },
  'quota.warning': { level: 'WARNING', group: 'Kota', title: "Günlük sınırın %80'i kullanıldı", repeatMin: 720 },
  'quota.reached': { level: 'WARNING', group: 'Kota', title: 'Günlük sınır doldu', repeatMin: 720 },
  'mail.send_failed': { level: 'CRITICAL', group: 'E-posta', title: 'E-posta gönderilemedi', repeatMin: 60 },
  'mailbox.sync_failed': { level: 'WARNING', group: 'E-posta', title: 'Gelen kutusu eşitlenemedi', repeatMin: 360 },
  'campaign.failed': { level: 'WARNING', group: 'E-posta', title: 'Kampanyada gönderilemeyen e-postalar var', repeatMin: 60 },
  'campaign.stopped': { level: 'WARNING', group: 'E-posta', title: 'Kampanya gönderimi durdu', repeatMin: 60 },
  'instagram.sync_failed': { level: 'WARNING', group: 'İçerik', title: 'Instagram akışı güncellenemedi', repeatMin: 1440 },
  'security.account_locked': { level: 'WARNING', group: 'Güvenlik', title: 'Bir hesaba çok sayıda adresten giriş denendi', repeatMin: 360 },
  'security.ip_locked': { level: 'INFO', group: 'Güvenlik', title: 'Bir adres çok fazla hatalı giriş denedi', repeatMin: 60 },
  'security.mfa_disabled': { level: 'WARNING', group: 'Güvenlik', title: 'Personel iki adımlı doğrulamayı kapattı', repeatMin: 60 },
  'security.staff_changed': { level: 'WARNING', group: 'Güvenlik', title: 'Personel yetkisi değişti', repeatMin: 60 },
  'cron.failed': { level: 'WARNING', group: 'Sistem', title: 'Zamanlanmış iş hata verdi', repeatMin: 120 },
  'cron.late': { level: 'WARNING', group: 'Sistem', title: 'Zamanlanmış iş çalışmıyor', repeatMin: 360 },
} as const satisfies Record<string, { level: 'INFO' | 'WARNING' | 'CRITICAL'; group: string; title: string; repeatMin: number }>;

export type AlertCode = keyof typeof ALERT_CATALOG;
export const ALERT_CODES = Object.keys(ALERT_CATALOG) as AlertCode[];

/** EXT-01/02: alerts are posted only to these chat services, so a typo or a tampered setting can't aim the API elsewhere. */
export const WEBHOOK_HOSTS = ['hooks.slack.com', 'discord.com', 'discordapp.com', 'chat.googleapis.com'];

export function webhookAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.port && !u.username && !u.password && WEBHOOK_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

/** LOG-02: an address in an alert shows only enough to recognise it. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

/** Any address inside a free text (a mail server's refusal, say) is masked the same way. */
export const maskEmails = (text: string) => text.replace(/[^\s<>"'(),;:@]+@[^\s<>"'(),;:@]+\.[a-z]{2,}/gi, (m) => maskEmail(m));
