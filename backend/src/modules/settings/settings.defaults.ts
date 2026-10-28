/** Typed defaults for every Setting key. DB values are merged over these, so new fields roll out safely. */
export const SETTING_DEFAULTS = {
  store: {
    name: 'MAEYJA',
    tagline: 'Hand crafted elegance.',
    email: 'hello@maeyja.com',
    phone: '',
    address: 'İstanbul, Türkiye',
    instagram: 'https://www.instagram.com/maeyja_official/',
    announcement: { tr: '', en: '' } as Record<string, string>,
  },
  shipping: {
    flatRate: 0,
    freeShippingThreshold: 0, // 0 → always free
    estimatedDays: '1-3',
    carriers: [
      { code: 'aras', name: 'Aras Kargo', trackingUrl: 'https://kargotakip.araskargo.com.tr/mainpage.aspx?code={tracking}' },
      { code: 'yurtici', name: 'Yurtiçi Kargo', trackingUrl: 'https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code={tracking}' },
      { code: 'mng', name: 'MNG Kargo', trackingUrl: 'https://www.mngkargo.com.tr/gonderitakip/{tracking}' },
    ] as { code: string; name: string; trackingUrl: string }[],
  },
  tax: {
    defaultRate: 20, // leather goods; clothing is usually 10 — override per product
  },
  checkout: {
    guestCheckout: true,
    maxQtyPerItem: 5,
  },
  bankTransfer: {
    enabled: false,
    bankName: '',
    accountName: '',
    iban: '',
    note: { tr: 'Açıklamaya sipariş numaranızı yazınız.', en: 'Please put your order number in the transfer description.' } as Record<string, string>,
  },
};

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingValue<K extends SettingKey> = (typeof SETTING_DEFAULTS)[K];
export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];
