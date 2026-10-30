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
  /** Storefront chat assistant (Claude). Off until switched on in the admin. */
  assistant: {
    enabled: false,
    welcome: {
      tr: 'Merhaba, size nasıl yardımcı olabilirim? Modellerimiz, renkler, ölçüler, kargo ve iade hakkında sorabilirsiniz.',
      en: 'Hello, how can I help? Ask me about our bags, colours, sizes, shipping or returns.',
    } as Record<string, string>,
    /** Extra rules and facts from the owner, appended to the assistant's instructions. */
    instructions: '',
    /** WhatsApp number of the person who takes over urgent cases (e.g. +33 6 …); empty: the assistant points to e-mail. */
    handoffWhatsapp: '',
  },
  /** "Üzerimde gör" virtual try-on on product pages (Gemini). Off until switched on in the admin. */
  tryon: {
    enabled: false,
  },
  /**
   * Ad pixels and search/AI visibility. IDs are public (they reach the browser); the Conversions API token and
   * the GA4 API secret stay on the server and are only used for purchases sent from the server.
   */
  tracking: {
    metaPixelId: '',
    metaCapiToken: '',
    metaTestCode: '',
    ga4Id: '',
    ga4ApiSecret: '',
    googleAdsId: '',
    googleAdsPurchaseLabel: '',
    googleSiteVerification: '',
    /** robots.txt lets AI assistants (ChatGPT, Claude, Perplexity, Gemini…) read the shop. */
    allowAiCrawlers: true,
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
