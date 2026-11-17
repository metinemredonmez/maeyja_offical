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
   * Colours of the product pages only: the page ground and the tile behind the bag photos (BOYY: white page,
   * #F2F2F2 tiles — the photos' own studio grey). The defaults are the site's cream.
   */
  productPage: {
    ground: '#f5f1ea',
    tile: '#e9e3d8',
  },
  /** AI studio in the admin: new products get an on-model photo suggestion of their own (it waits for approval). */
  aiStudio: {
    autoModel: true,
  },
  /** Abandoned-cart reminder: one short e-mail, written by AI, to signed-in customers who agreed to e-mails. Off until switched on. */
  cartReminder: {
    enabled: false,
    delayHours: 3,
  },
  /** Maintenance: the storefront answers every page with a "back soon" page (503), except for the staff preview link. */
  maintenance: {
    enabled: false,
    /** Secret in the staff preview link (?preview=…); made the first time maintenance is switched on. */
    previewToken: '',
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
  /**
   * Where alerts go (LOG-04). Empty e-mail: ADMIN_NOTIFY_EMAIL. The webhook (Slack, Discord or Google Chat) is a
   * secret: its address alone lets anyone post to the channel. Muted codes stay in the panel but aren't sent.
   */
  alerts: {
    email: '',
    webhookUrl: '',
    muted: [] as string[],
  },
  /**
   * Automatic e-mails (Admin → Otomatik e-postalar), each off until switched on. Texts in Turkish and English (other
   * languages get English); {name} becomes " Ad" when the name is known, {coupon} the code (a paragraph with an
   * empty {coupon} is left out). Only people who may receive marketing get them, and every one has an unsubscribe link.
   */
  mailWelcome: {
    enabled: false,
    subject: { tr: "MAEYJA'ya hoş geldiniz", en: 'Welcome to MAEYJA' } as Record<string, string>,
    body: {
      tr: "Merhaba{name},\n\nMAEYJA'ya katıldığınız için teşekkür ederiz. Çantalarımız atölyemizde, tek parça deriden elle kesilip dikiliyor; her modelden az sayıda üretiyoruz.\n\nYeni modelleri, atölyeden haberleri ve özel davetleri ilk siz duyacaksınız.",
      en: 'Hello{name},\n\nThank you for joining MAEYJA. Our bags are cut and stitched by hand in our atelier, from a single piece of leather, and made in small numbers.\n\nYou will be the first to hear about new models, news from the atelier and private invitations.',
    } as Record<string, string>,
  },
  mailAfterPurchase: {
    enabled: false,
    /** Days after the order was shipped. */
    delayDays: 10,
    /** Only buyers who agreed to marketing e-mails. */
    onlyConsented: true,
    subject: { tr: 'Çantanız nasıl?', en: 'How is your bag?' } as Record<string, string>,
    body: {
      tr: "Merhaba{name},\n\nÇantanızın size sorunsuz ulaştığını umuyoruz. Derinin uzun yıllar güzel kalması için birkaç küçük öneriyi bakım rehberimizde topladık.\n\nDüşüncelerinizi duymayı çok isteriz; bu e-postayı yanıtlamanız yeterli. Instagram'da paylaşırsanız @maeyja_official etiketiyle görmekten mutluluk duyarız.",
      en: 'Hello{name},\n\nWe hope your bag has reached you safely. To keep the leather beautiful for years, we have gathered a few simple tips in our care guide.\n\nWe would love to hear what you think — simply reply to this e-mail. If you share it on Instagram, tag @maeyja_official; we would be delighted to see it.',
    } as Record<string, string>,
  },
  mailWinback: {
    enabled: false,
    /** Customers whose last order is older than this many days; each hears at most once in that time. */
    afterDays: 180,
    /** An existing, active coupon code, or empty. */
    coupon: '',
    subject: { tr: 'Sizi özledik', en: 'We have missed you' } as Record<string, string>,
    body: {
      tr: 'Merhaba{name},\n\nSizi bir süredir görmedik. Atölyede yeni modeller ve renkler üzerinde çalıştık.\n\nBir sonraki siparişinizde {coupon} kodunu kullanabilirsiniz.',
      en: 'Hello{name},\n\nIt has been a while. In the atelier we have been working on new models and colours.\n\nUse the code {coupon} on your next order.',
    } as Record<string, string>,
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
