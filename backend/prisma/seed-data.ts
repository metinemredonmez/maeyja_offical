/**
 * Seed copy in all 11 storefront languages. `tr` is the base column value; the rest go to `translations`.
 * Product names are brand names and stay the same everywhere.
 */
export const LANGS = ['tr', 'en', 'ru', 'nl', 'de', 'fr', 'it', 'es', 'ko', 'ja', 'zh'] as const;
export type Lang = (typeof LANGS)[number];
/** One text in every language. */
export type L = Record<Lang, string>;
export type Translations = Record<string, Record<string, string>>;

/** `{ title: L, body: L }` → base Turkish fields + `{ en: { title, body }, … }`. */
export function split<K extends string>(fields: Record<K, L>): { base: Record<K, string>; translations: Translations } {
  const base = {} as Record<K, string>;
  const translations: Translations = {};
  for (const [key, text] of Object.entries(fields) as [K, L][]) {
    base[key] = text.tr;
    for (const lang of LANGS) {
      if (lang === 'tr') continue;
      (translations[lang] ??= {})[key] = text[lang];
    }
  }
  return { base, translations };
}

/** A brand name kept as is in every language. */
const same = (text: string): L => Object.fromEntries(LANGS.map((lang) => [lang, text])) as L;

// ───────── Colours ─────────
export const COLORS: { slug: string; hex: string; hex2?: string; name: L }[] = [
  // Kasım 2026 colourways (Canan): brand names, the same in every language, as BOYY does. Only these four (and
  // Black/Moon, a bag in both); the first seed's Kırmızı, Beyaz, Yeşil, Çift Renk and Fildişi were dropped.
  { slug: 'chili', hex: '#B3261E', name: same('Chili') },
  { slug: 'botanic', hex: '#1F3B3A', name: same('Botanic') },
  { slug: 'moon', hex: '#ECE6DA', name: same('Moon') },
  { slug: 'black-moon', hex: '#141414', hex2: '#ECE6DA', name: same('Black/Moon') },
  { slug: 'black', hex: '#141414', name: { tr: 'Siyah', en: 'Black', ru: 'Чёрный', nl: 'Zwart', de: 'Schwarz', fr: 'Noir', it: 'Nero', es: 'Negro', ko: '블랙', ja: 'ブラック', zh: '黑色' } },
];

// ───────── Taxonomy ─────────
export const CATEGORIES: { slug: string; sortOrder: number; isActive: boolean; name: L }[] = [
  { slug: 'bags', sortOrder: 0, isActive: true, name: { tr: 'Çantalar', en: 'Bags', ru: 'Сумки', nl: 'Tassen', de: 'Taschen', fr: 'Sacs', it: 'Borse', es: 'Bolsos', ko: '가방', ja: 'バッグ', zh: '包袋' } },
  { slug: 'ready-to-wear', sortOrder: 1, isActive: false, name: { tr: 'Giyim', en: 'Ready-to-wear', ru: 'Одежда', nl: 'Kleding', de: 'Kleidung', fr: 'Prêt-à-porter', it: 'Abbigliamento', es: 'Ropa', ko: '의류', ja: 'ウェア', zh: '成衣' } },
];

export const SIGNATURE_COLLECTION: { description: L } = {
  description: {
    tr: 'İstanbul’da elde üretilen, heykelsi formlu ikonik çanta.',
    en: 'The sculptural icon, handcrafted in Istanbul.',
    ru: 'Скульптурная икона, созданная вручную в Стамбуле.',
    nl: 'Het sculpturale icoon, met de hand gemaakt in Istanbul.',
    de: 'Die skulpturale Ikone, handgefertigt in Istanbul.',
    fr: 'L’icône sculpturale, faite main à Istanbul.',
    it: 'L’icona scultorea, realizzata a mano a Istanbul.',
    es: 'El icono escultórico, hecho a mano en Estambul.',
    ko: '이스탄불에서 수작업으로 완성한 조각적인 아이콘.',
    ja: 'イスタンブールで手仕事により生まれた、彫刻的なアイコン。',
    zh: '在伊斯坦布尔手工打造的雕塑感经典之作。',
  },
};

// ───────── Homepage (matched by section type) ─────────
export const HOME: Record<string, Record<string, L>> = {
  HERO: {
    subtitle: { tr: 'İstanbul’da elde üretildi.', en: 'Handmade in Istanbul.', ru: 'Сделано вручную в Стамбуле.', nl: 'Handgemaakt in Istanbul.', de: 'Handgefertigt in Istanbul.', fr: 'Fait main à Istanbul.', it: 'Fatto a mano a Istanbul.', es: 'Hecho a mano en Estambul.', ko: '이스탄불에서 수작업으로 제작', ja: 'イスタンブールでハンドメイド。', zh: '伊斯坦布尔手工制作。' },
    ctaLabel: { tr: 'Keşfet', en: 'Discover', ru: 'Смотреть', nl: 'Ontdek', de: 'Entdecken', fr: 'Découvrir', it: 'Scopri', es: 'Descubrir', ko: '둘러보기', ja: '見る', zh: '探索' },
  },
  FEATURED_PRODUCTS: {
    title: { tr: 'Koleksiyon', en: 'The collection', ru: 'Коллекция', nl: 'De collectie', de: 'Die Kollektion', fr: 'La collection', it: 'La collezione', es: 'La colección', ko: '컬렉션', ja: 'コレクション', zh: '系列' },
  },
  CRAFT_STORY: {
    title: { tr: 'Atölyeden', en: 'From the atelier', ru: 'Из мастерской', nl: 'Uit het atelier', de: 'Aus dem Atelier', fr: 'De l’atelier', it: 'Dall’atelier', es: 'Desde el taller', ko: '아틀리에에서', ja: 'アトリエから', zh: '来自工坊' },
    body: {
      tr: 'Tek parça deri, iki gün süren el işçiliği ve sayılı üretim.',
      en: 'A single piece of leather, two days of handwork, limited production.',
      ru: 'Цельный кусок кожи, два дня ручной работы, ограниченный выпуск.',
      nl: 'Eén stuk leer, twee dagen handwerk, beperkte productie.',
      de: 'Ein einziges Stück Leder, zwei Tage Handarbeit, limitierte Fertigung.',
      fr: 'Une seule pièce de cuir, deux jours de travail à la main, une production limitée.',
      it: 'Un unico pezzo di pelle, due giorni di lavoro a mano, produzione limitata.',
      es: 'Una sola pieza de piel, dos días de trabajo artesanal, producción limitada.',
      ko: '한 장의 가죽, 이틀간의 수작업, 한정 생산.',
      ja: '一枚革、二日間の手仕事、限定生産。',
      zh: '一整张皮革，两天的手工制作，限量生产。',
    },
    ctaLabel: { tr: 'Hikâyemiz', en: 'Our story', ru: 'Наша история', nl: 'Ons verhaal', de: 'Unsere Geschichte', fr: 'Notre histoire', it: 'La nostra storia', es: 'Nuestra historia', ko: '브랜드 스토리', ja: 'ストーリー', zh: '品牌故事' },
  },
  PRESS: {
    title: { tr: 'Basında', en: 'Press', ru: 'Пресса', nl: 'Pers', de: 'Presse', fr: 'Presse', it: 'Stampa', es: 'Prensa', ko: '프레스', ja: 'プレス', zh: '媒体报道' },
  },
  STOCKISTS: {
    title: { tr: 'Satış Noktaları', en: 'Stockists', ru: 'Где купить', nl: 'Verkooppunten', de: 'Händler', fr: 'Points de vente', it: 'Punti vendita', es: 'Puntos de venta', ko: '판매처', ja: '取扱店', zh: '销售点' },
  },
  NEWSLETTER: {
    title: { tr: 'Yeni koleksiyonlardan ilk siz haberdar olun', en: 'Be the first to know', ru: 'Узнавайте первыми', nl: 'Hoor het als eerste', de: 'Als Erste erfahren', fr: 'Soyez les premiers informés', it: 'Scoprilo per primo', es: 'Sé el primero en saberlo', ko: '가장 먼저 소식을 받아보세요', ja: '最新情報をいち早く', zh: '抢先获取最新消息' },
  },
};

// ───────── Pages (titles; bodies are written in the admin) ─────────
export const PAGES: { slug: string; title: L }[] = [
  { slug: 'about', title: { tr: 'Hakkımızda', en: 'About', ru: 'О нас', nl: 'Over ons', de: 'Über uns', fr: 'À propos', it: 'Chi siamo', es: 'Sobre nosotros', ko: '브랜드 소개', ja: 'ブランドについて', zh: '关于我们' } },
  { slug: 'shipping-returns', title: { tr: 'Kargo ve İade', en: 'Shipping & Returns', ru: 'Доставка и возврат', nl: 'Verzending & retour', de: 'Versand & Rückgabe', fr: 'Livraison et retours', it: 'Spedizioni e resi', es: 'Envíos y devoluciones', ko: '배송 및 반품', ja: '配送・返品', zh: '配送与退货' } },
  { slug: 'distance-sales-agreement', title: { tr: 'Mesafeli Satış Sözleşmesi', en: 'Distance Sales Agreement', ru: 'Договор дистанционной продажи', nl: 'Overeenkomst op afstand', de: 'Fernabsatzvertrag', fr: 'Contrat de vente à distance', it: 'Contratto di vendita a distanza', es: 'Contrato de venta a distancia', ko: '원격 판매 계약', ja: '通信販売契約', zh: '远程销售协议' } },
  { slug: 'preliminary-information', title: { tr: 'Ön Bilgilendirme Formu', en: 'Preliminary Information Form', ru: 'Предварительная информация', nl: 'Precontractuele informatie', de: 'Vorvertragliche Informationen', fr: 'Informations précontractuelles', it: 'Informativa precontrattuale', es: 'Información precontractual', ko: '사전 고지 사항', ja: '事前情報', zh: '预先告知书' } },
  { slug: 'kvkk', title: { tr: 'KVKK Aydınlatma Metni', en: 'Personal Data Notice', ru: 'Уведомление о персональных данных', nl: 'Privacyverklaring persoonsgegevens', de: 'Datenschutzhinweis', fr: 'Avis relatif aux données personnelles', it: 'Informativa sui dati personali', es: 'Aviso de datos personales', ko: '개인정보 고지', ja: '個人情報に関する通知', zh: '个人数据告知' } },
  { slug: 'privacy', title: { tr: 'Gizlilik ve Çerez Politikası', en: 'Privacy & Cookie Policy', ru: 'Политика конфиденциальности и cookie', nl: 'Privacy- en cookiebeleid', de: 'Datenschutz- und Cookie-Richtlinie', fr: 'Politique de confidentialité et cookies', it: 'Privacy e cookie policy', es: 'Política de privacidad y cookies', ko: '개인정보 및 쿠키 정책', ja: 'プライバシー・Cookieポリシー', zh: '隐私与 Cookie 政策' } },
  { slug: 'terms', title: { tr: 'Kullanım Koşulları', en: 'Terms of Use', ru: 'Условия использования', nl: 'Gebruiksvoorwaarden', de: 'Nutzungsbedingungen', fr: 'Conditions d’utilisation', it: 'Termini di utilizzo', es: 'Términos de uso', ko: '이용 약관', ja: '利用規約', zh: '使用条款' } },
  { slug: 'expertise', title: { tr: 'Uzmanlık', en: 'Expertise', ru: 'Мастерство', nl: 'Vakmanschap', de: 'Handwerk', fr: 'Savoir-faire', it: 'Maestria', es: 'Artesanía', ko: '장인정신', ja: 'クラフト', zh: '工艺' } },
  { slug: 'care', title: { tr: 'Deri Bakım Rehberi', en: 'Leather Care Guide', ru: 'Уход за кожей', nl: 'Leerverzorging', de: 'Lederpflege', fr: 'Guide d’entretien du cuir', it: 'Guida alla cura della pelle', es: 'Guía de cuidado del cuero', ko: '가죽 관리 가이드', ja: 'レザーケアガイド', zh: '皮革护理指南' } },
];

/**
 * About page body (TR + EN; other languages fall back to English until they are translated in the admin).
 * Sources: ELLE Türkiye, 30.10.2019 ("MAEYJA çantaları estetik ve fonksiyonelliği buluşturuyor") and the
 * designer's public profile. Edit freely in the admin — the seed only replaces the original placeholder.
 */
export const ABOUT_BODY: Partial<L> & { tr: string; en: string } = {
  tr: `<h2>Canan Delettre</h2>
<p>MAEYJA, tasarımcı Canan Delettre’nin markası. Paris’teki Créapole tasarım okulunda yetişen Delettre, çantalarını Fransa’da tasarlıyor; her parça İstanbul’daki usta deri zanaatkârlarının elinde hayat buluyor.</p>
<p>Mimari, tasarım, sanat ve müzikten beslenen MAEYJA çantaları ilk bakışta yalın görünür; asıl hikâye detaylarda saklıdır. Delettre’nin aradığı şey; işlevsel, pratik, duygusal, estetik ve şehirli olan arasındaki doğru dengedir: kusursuz ve zarif, ama resmiyetten uzak.</p>
<h2>Atölye</h2>
<p>Her model tek parça deriden katlanarak biçimlenir. Kesim, dikiş ve son dokunuşlar İstanbul’daki atölyede elde yapılır; üretim sayılıdır.</p>
<h2>Basında ve mağazalarda</h2>
<p>MAEYJA, ELLE Türkiye ve Vogue Türkiye’de yer aldı; Beymen İstinye’de ve maeyja.com’da satılıyor.</p>`,
  en: `<h2>Canan Delettre</h2>
<p>MAEYJA is the label of designer Canan Delettre. Trained at Créapole design school in Paris, she designs her bags in France, and every piece is brought to life by master leather artisans in Istanbul.</p>
<p>Drawing on architecture, design, art and music, a MAEYJA bag looks simple at first glance — the story is in the details. What Delettre looks for is the right balance between the functional, the practical, the emotional, the aesthetic and the urban: precise and elegant, but never formal.</p>
<h2>The atelier</h2>
<p>Each model is folded into shape from a single piece of leather. Cutting, stitching and finishing are done by hand in the Istanbul atelier, in limited numbers.</p>
<h2>Press &amp; stockists</h2>
<p>MAEYJA has been featured in ELLE Türkiye and Vogue Türkiye, and is available at Beymen İstinye and on maeyja.com.</p>`,
};

// ───────── FAQ (matched by the Turkish question) ─────────
export const FAQS: { sortOrder: number; group: L; question: L; answer: L }[] = [
  {
    sortOrder: 0,
    group: { tr: 'Sipariş', en: 'Orders', ru: 'Заказы', nl: 'Bestellingen', de: 'Bestellungen', fr: 'Commandes', it: 'Ordini', es: 'Pedidos', ko: '주문', ja: 'ご注文', zh: '订单' },
    question: { tr: 'Siparişim ne zaman kargoya verilir?', en: 'When will my order ship?', ru: 'Когда будет отправлен мой заказ?', nl: 'Wanneer wordt mijn bestelling verzonden?', de: 'Wann wird meine Bestellung versandt?', fr: 'Quand ma commande sera-t-elle expédiée ?', it: 'Quando verrà spedito il mio ordine?', es: '¿Cuándo se enviará mi pedido?', ko: '주문은 언제 발송되나요?', ja: '注文はいつ発送されますか？', zh: '我的订单何时发货？' },
    answer: { tr: 'Stoktaki ürünler 1–3 iş günü içinde kargoya verilir.', en: 'In-stock items ship within 1–3 business days.', ru: 'Товары в наличии отправляются в течение 1–3 рабочих дней.', nl: 'Artikelen op voorraad worden binnen 1–3 werkdagen verzonden.', de: 'Vorrätige Artikel werden innerhalb von 1–3 Werktagen versandt.', fr: 'Les articles en stock sont expédiés sous 1 à 3 jours ouvrés.', it: 'Gli articoli disponibili vengono spediti entro 1–3 giorni lavorativi.', es: 'Los artículos en stock se envían en 1–3 días laborables.', ko: '재고가 있는 상품은 영업일 기준 1–3일 이내에 발송됩니다.', ja: '在庫のある商品は1〜3営業日以内に発送します。', zh: '有现货的商品将在 1–3 个工作日内发货。' },
  },
  {
    sortOrder: 1,
    group: { tr: 'İade', en: 'Returns', ru: 'Возврат', nl: 'Retouren', de: 'Rückgabe', fr: 'Retours', it: 'Resi', es: 'Devoluciones', ko: '반품', ja: '返品', zh: '退货' },
    question: { tr: 'İade süresi kaç gün?', en: 'How long do I have to return an item?', ru: 'Сколько дней на возврат?', nl: 'Hoe lang heb ik om te retourneren?', de: 'Wie lange habe ich Zeit für eine Rückgabe?', fr: 'Combien de temps ai-je pour retourner un article ?', it: 'Entro quanto posso effettuare un reso?', es: '¿Cuánto tiempo tengo para devolver un artículo?', ko: '반품 기한은 며칠인가요?', ja: '返品期限は何日ですか？', zh: '退货期限是多少天？' },
    answer: { tr: 'Teslimattan itibaren 14 gün içinde iade talebi oluşturabilirsiniz.', en: 'You can request a return within 14 days of delivery.', ru: 'Вы можете оформить возврат в течение 14 дней после доставки.', nl: 'Je kunt binnen 14 dagen na levering een retour aanvragen.', de: 'Sie können innerhalb von 14 Tagen nach Lieferung eine Rückgabe beantragen.', fr: 'Vous pouvez demander un retour dans les 14 jours suivant la livraison.', it: 'Puoi richiedere un reso entro 14 giorni dalla consegna.', es: 'Puedes solicitar una devolución en un plazo de 14 días desde la entrega.', ko: '배송 완료일로부터 14일 이내에 반품을 신청할 수 있습니다.', ja: 'お届けから14日以内に返品をお申し込みいただけます。', zh: '您可在收货后 14 天内申请退货。' },
  },
  {
    sortOrder: 2,
    group: { tr: 'Bakım', en: 'Care', ru: 'Уход', nl: 'Verzorging', de: 'Pflege', fr: 'Entretien', it: 'Cura', es: 'Cuidado', ko: '관리', ja: 'お手入れ', zh: '护理' },
    question: { tr: 'Deri çantamı nasıl temizlerim?', en: 'How do I clean my leather bag?', ru: 'Как чистить кожаную сумку?', nl: 'Hoe maak ik mijn leren tas schoon?', de: 'Wie reinige ich meine Ledertasche?', fr: 'Comment nettoyer mon sac en cuir ?', it: 'Come pulisco la mia borsa in pelle?', es: '¿Cómo limpio mi bolso de piel?', ko: '가죽 가방은 어떻게 관리하나요?', ja: 'レザーバッグのお手入れ方法は？', zh: '如何清洁我的皮包？' },
    answer: { tr: 'Kuru, yumuşak bir bezle silin; kimyasal temizleyici kullanmayın.', en: 'Wipe it with a soft, dry cloth; do not use chemical cleaners.', ru: 'Протирайте мягкой сухой тканью, не используйте химические средства.', nl: 'Veeg af met een zachte, droge doek; gebruik geen chemische reinigers.', de: 'Mit einem weichen, trockenen Tuch abwischen; keine chemischen Reiniger verwenden.', fr: 'Essuyez-le avec un chiffon doux et sec ; n’utilisez pas de nettoyants chimiques.', it: 'Pulisci con un panno morbido e asciutto; non usare detergenti chimici.', es: 'Límpialo con un paño suave y seco; no uses limpiadores químicos.', ko: '부드럽고 마른 천으로 닦아 주세요. 화학 세정제는 사용하지 마세요.', ja: '柔らかい乾いた布で拭いてください。化学洗剤は使用しないでください。', zh: '请用柔软的干布擦拭，切勿使用化学清洁剂。' },
  },
];

// ───────── Products ─────────
/** Shared by every bag. */
export const PRODUCT_COMMON: Record<'material' | 'care' | 'story' | 'madeIn', L> = {
  material: { tr: 'Hakiki deri', en: 'Genuine leather', ru: 'Натуральная кожа', nl: 'Echt leer', de: 'Echtleder', fr: 'Cuir véritable', it: 'Vera pelle', es: 'Piel auténtica', ko: '천연 가죽', ja: '本革', zh: '真皮' },
  care: {
    tr: 'Doğrudan güneş ışığından ve nemden uzak tutun. Kuru, yumuşak bir bezle silin ve kullanmadığınızda toz torbasında saklayın.',
    en: 'Keep away from direct sunlight and moisture. Wipe with a soft, dry cloth and store in its dust bag when not in use.',
    ru: 'Берегите от прямых солнечных лучей и влаги. Протирайте мягкой сухой тканью и храните в пыльнике.',
    nl: 'Uit direct zonlicht en vocht houden. Afvegen met een zachte, droge doek en bewaren in de stofzak.',
    de: 'Vor direktem Sonnenlicht und Feuchtigkeit schützen. Mit einem weichen, trockenen Tuch abwischen und im Staubbeutel aufbewahren.',
    fr: 'Tenir à l’abri de la lumière directe du soleil et de l’humidité. Essuyer avec un chiffon doux et sec et ranger dans sa housse.',
    it: 'Tenere lontano dalla luce diretta del sole e dall’umidità. Pulire con un panno morbido e asciutto e conservare nella sua sacca.',
    es: 'Mantener alejado de la luz solar directa y la humedad. Limpiar con un paño suave y seco y guardar en su funda.',
    ko: '직사광선과 습기를 피해 주세요. 부드럽고 마른 천으로 닦고, 사용하지 않을 때는 더스트백에 보관하세요.',
    ja: '直射日光と湿気を避けてください。柔らかい乾いた布で拭き、使用しないときは保存袋に入れて保管してください。',
    zh: '避免阳光直射和潮湿。请用柔软的干布擦拭，不用时放入防尘袋保存。',
  },
  story: {
    tr: 'Her parça atölyemizde elde kesilip dikilir.',
    en: 'Every piece is hand-cut and stitched in our atelier.',
    ru: 'Каждое изделие вручную раскраивается и сшивается в нашей мастерской.',
    nl: 'Elk stuk wordt in ons atelier met de hand gesneden en gestikt.',
    de: 'Jedes Stück wird in unserem Atelier von Hand zugeschnitten und genäht.',
    fr: 'Chaque pièce est coupée et cousue à la main dans notre atelier.',
    it: 'Ogni pezzo è tagliato e cucito a mano nel nostro atelier.',
    es: 'Cada pieza se corta y se cose a mano en nuestro taller.',
    ko: '모든 제품은 아틀리에에서 손으로 재단하고 바느질합니다.',
    ja: 'すべての製品はアトリエで一点ずつ手作業で裁断・縫製しています。',
    zh: '每一件都在我们的工坊中手工裁剪、缝制。',
  },
  madeIn: { tr: 'Türkiye', en: 'Türkiye', ru: 'Турция', nl: 'Turkije', de: 'Türkei', fr: 'Turquie', it: 'Turchia', es: 'Turquía', ko: '튀르키예', ja: 'トルコ', zh: '土耳其' },
};

export type SeedProduct = {
  slug: string;
  /** The model; with the colourway it reads "Petal Box, Chili". Each colourway is its own product (BOYY). */
  name: string;
  /** TRY, VAT included. */
  price: number;
  featured: boolean;
  /** The colourway; photos come from seed-assets/catalog/<slug>/ by colour tag. */
  variants: { color: string; sku: string; stock: number }[];
  subtitle: L;
  description: L;
  dimensions: L;
  material: L;
  /** The bag of the first catalogue it replaces: renamed in place on existing databases, so orders keep it. */
  replaces: { slug: string; color: string };
};

const COMMA = new Set<Lang>(['tr', 'ru', 'nl', 'de', 'fr', 'it', 'es']);

/** Width × height × depth in cm, in each language's words and decimal mark. */
function dims(w: number, h: number, d: number): L {
  const line = (lang: Lang, [a, b, c]: [string, string, string], unit = 'cm') => {
    const n = (v: number) => (COMMA.has(lang) ? String(v).replace('.', ',') : String(v));
    return `${a} ${n(w)} · ${b} ${n(h)} · ${c} ${n(d)} ${unit}`;
  };
  return {
    tr: line('tr', ['Genişlik', 'Yükseklik', 'Derinlik']),
    en: line('en', ['Width', 'Height', 'Depth']),
    ru: line('ru', ['Ширина', 'Высота', 'Глубина'], 'см'),
    nl: line('nl', ['Breedte', 'Hoogte', 'Diepte']),
    de: line('de', ['Breite', 'Höhe', 'Tiefe']),
    fr: line('fr', ['Largeur', 'Hauteur', 'Profondeur']),
    it: line('it', ['Larghezza', 'Altezza', 'Profondità']),
    es: line('es', ['Ancho', 'Alto', 'Fondo']),
    ko: line('ko', ['가로', '세로', '폭']),
    ja: `幅${w} × 高さ${h} × マチ${d} cm`,
    zh: `宽 ${w} × 高 ${h} × 深 ${d} 厘米`,
  };
}

const CALFSKIN: L = {
  tr: 'Gövde: dana derisi. Astar: tekstil.',
  en: 'Body: calfskin leather. Lining: textile.',
  ru: 'Корпус: телячья кожа. Подкладка: текстиль.',
  nl: 'Buitenkant: kalfsleer. Voering: textiel.',
  de: 'Außen: Kalbsleder. Futter: Textil.',
  fr: 'Extérieur : cuir de veau. Doublure : textile.',
  it: 'Esterno: pelle di vitello. Fodera: tessuto.',
  es: 'Exterior: piel de becerro. Forro: textil.',
  ko: '겉감: 카프스킨. 안감: 텍스타일.',
  ja: '本体：カーフレザー　裏地：テキスタイル',
  zh: '主体：小牛皮；内衬：织物',
};

/** Canan's copy (Kasım 2026), one text per model. */
const COPY: Record<'box' | 'shoulder24' | 'shoulder14' | 'lady' | 'cuff' | 'bucket12' | 'bucket20', L> = {
  box: {
    tr: 'Dana derisinden Petal Box çanta. Yalın geometrisi ve güçlü kimliğiyle öne çıkan, heykelsi bir imza parça.',
    en: 'Petal Box bag crafted from calfskin. A sculptural statement piece distinguished by its clean geometry and strong identity.',
    ru: 'Сумка Petal Box из телячьей кожи. Скульптурный акцентный аксессуар с чистой геометрией и ярким характером.',
    nl: 'Petal Box-tas van kalfsleer. Een sculpturaal statementstuk met strakke geometrie en een sterke identiteit.',
    de: 'Petal Box aus Kalbsleder. Ein skulpturales Statement-Piece mit klarer Geometrie und starker Identität.',
    fr: 'Sac Petal Box en cuir de veau. Une pièce sculpturale forte, à la géométrie épurée et à l’identité affirmée.',
    it: 'Borsa Petal Box in pelle di vitello. Un pezzo scultoreo di carattere, dalla geometria pulita e dall’identità forte.',
    es: 'Bolso Petal Box de piel de becerro. Una pieza escultórica de carácter, con una geometría limpia y una identidad marcada.',
    ko: '카프스킨으로 완성한 Petal Box 백. 깔끔한 기하학적 형태와 뚜렷한 개성이 돋보이는 조각 같은 스테이트먼트 피스.',
    ja: 'カーフレザーで仕立てたPetal Box。クリーンな幾何学フォルムと強い個性が際立つ、彫刻的なステートメントピース。',
    zh: 'Petal Box 手袋，采用小牛皮制作。以简洁的几何造型与鲜明个性著称的雕塑感单品。',
  },
  shoulder24: {
    tr: 'Dana derisinden Petal Shoulder çanta. Mimari çizgileri ve zahmetsiz zarafetiyle tanımlanan imza omuz çantamız. Ayırt edici görünümünü koruyarak her gün kullanılmak için tasarlandı.',
    en: 'Petal Shoulder bag crafted from calfskin. A signature shoulder bag defined by architectural lines and effortless elegance. Designed for everyday use while maintaining a distinctive visual identity.',
    ru: 'Сумка Petal Shoulder из телячьей кожи. Фирменная сумка на плечо с архитектурными линиями и непринуждённой элегантностью. Создана для каждого дня и при этом сохраняет узнаваемый характер.',
    nl: 'Petal Shoulder-tas van kalfsleer. Een signature schoudertas met architecturale lijnen en moeiteloze elegantie. Gemaakt voor elke dag, met een herkenbare eigen identiteit.',
    de: 'Petal Shoulder aus Kalbsleder. Eine Signature-Schultertasche mit architektonischen Linien und müheloser Eleganz. Für jeden Tag gemacht, mit unverwechselbarer Handschrift.',
    fr: 'Sac Petal Shoulder en cuir de veau. Un sac porté épaule signature, aux lignes architecturales et à l’élégance naturelle. Pensé pour tous les jours, sans rien perdre de son identité.',
    it: 'Borsa Petal Shoulder in pelle di vitello. Una borsa a spalla iconica, dalle linee architettoniche e dall’eleganza spontanea. Pensata per ogni giorno, con un’identità inconfondibile.',
    es: 'Bolso Petal Shoulder de piel de becerro. Un bolso de hombro emblemático, de líneas arquitectónicas y elegancia natural. Pensado para el día a día sin perder su identidad.',
    ko: '카프스킨으로 완성한 Petal Shoulder 백. 건축적인 라인과 자연스러운 우아함이 돋보이는 시그니처 숄더백입니다. 데일리로 사용하기 좋으면서도 고유한 존재감을 지닙니다.',
    ja: 'カーフレザーで仕立てたPetal Shoulder。建築的なラインと自然なエレガンスが特徴のシグネチャー ショルダーバッグ。日常使いに寄り添いながら、独自の存在感を保ちます。',
    zh: 'Petal Shoulder 手袋，采用小牛皮制作。以建筑感线条与从容优雅定义的标志性肩背包，适合日常使用，同时保有鲜明的辨识度。',
  },
  shoulder14: {
    tr: 'Dana derisinden Petal Shoulder çanta. Özgün siluetin daha kompakt bir yorumu. Hafif, çok yönlü ve çağdaş.',
    en: 'Petal Shoulder bag crafted from calfskin. A more compact interpretation of the original silhouette. Light, versatile and contemporary.',
    ru: 'Сумка Petal Shoulder из телячьей кожи. Более компактная интерпретация оригинального силуэта. Лёгкая, универсальная и современная.',
    nl: 'Petal Shoulder-tas van kalfsleer. Een compactere interpretatie van het oorspronkelijke silhouet. Licht, veelzijdig en eigentijds.',
    de: 'Petal Shoulder aus Kalbsleder. Eine kompaktere Interpretation der ursprünglichen Silhouette. Leicht, vielseitig und zeitgemäß.',
    fr: 'Sac Petal Shoulder en cuir de veau. Une interprétation plus compacte de la silhouette d’origine. Léger, polyvalent et contemporain.',
    it: 'Borsa Petal Shoulder in pelle di vitello. Un’interpretazione più compatta della silhouette originale. Leggera, versatile e contemporanea.',
    es: 'Bolso Petal Shoulder de piel de becerro. Una interpretación más compacta de la silueta original. Ligero, versátil y contemporáneo.',
    ko: '카프스킨으로 완성한 Petal Shoulder 백. 오리지널 실루엣을 더 콤팩트하게 해석했습니다. 가볍고 다재다능하며 현대적입니다.',
    ja: 'カーフレザーで仕立てたPetal Shoulder。オリジナルのシルエットをよりコンパクトに再解釈。軽やかで汎用性が高く、モダンな一品です。',
    zh: 'Petal Shoulder 手袋，采用小牛皮制作。原版廓形的更小巧演绎，轻盈、百搭而现代。',
  },
  lady: {
    tr: 'Dana derisinden Petal Lady çanta. Modern yaşam için tasarlanmış zarif bir temel parça. Ölçüsü kompakt, karakteri cömert. Zarif ve feminen. Ayarlanabilir deri askısıyla omuzda ya da çapraz taşınabilir.',
    en: 'Petal Lady bag crafted from calfskin. A refined essential designed for modern lifestyles. Compact in scale yet generous in character. Elegant and feminine. Features an adjustable leather strap for versatile styling as a shoulder or crossbody bag.',
    ru: 'Сумка Petal Lady из телячьей кожи. Изысканная база для современного ритма жизни. Компактная по размеру, но щедрая по характеру. Элегантная и женственная. Регулируемый кожаный ремень позволяет носить её на плече или через плечо.',
    nl: 'Petal Lady-tas van kalfsleer. Een verfijnde basis voor een moderne levensstijl. Compact van formaat, groot van karakter. Elegant en vrouwelijk. Met een verstelbare leren band om over de schouder of crossbody te dragen.',
    de: 'Petal Lady aus Kalbsleder. Ein raffiniertes Essential für den modernen Alltag. Kompakt im Format, großzügig im Charakter. Elegant und feminin. Mit verstellbarem Lederriemen, über der Schulter oder crossbody zu tragen.',
    fr: 'Sac Petal Lady en cuir de veau. Un essentiel raffiné pensé pour la vie moderne. Compact par sa taille, généreux par son caractère. Élégant et féminin. Sa bandoulière en cuir réglable permet de le porter à l’épaule ou en travers.',
    it: 'Borsa Petal Lady in pelle di vitello. Un essenziale raffinato pensato per lo stile di vita moderno. Compatta nelle dimensioni, generosa nel carattere. Elegante e femminile. La tracolla in pelle regolabile permette di portarla a spalla o a tracolla.',
    es: 'Bolso Petal Lady de piel de becerro. Un esencial refinado pensado para la vida moderna. Compacto en tamaño, generoso en carácter. Elegante y femenino. Su correa de piel ajustable permite llevarlo al hombro o cruzado.',
    ko: '카프스킨으로 완성한 Petal Lady 백. 현대적인 라이프스타일을 위한 세련된 에센셜입니다. 크기는 콤팩트하지만 존재감은 넉넉합니다. 우아하고 여성스럽습니다. 길이 조절이 가능한 가죽 스트랩으로 숄더백이나 크로스바디로 연출할 수 있습니다.',
    ja: 'カーフレザーで仕立てたPetal Lady。モダンなライフスタイルのための洗練されたエッセンシャル。サイズはコンパクトながら、存在感は豊か。エレガントでフェミニンな一品です。長さを調節できるレザーストラップで、ショルダーにもクロスボディにも。',
    zh: 'Petal Lady 手袋，采用小牛皮制作。为现代生活方式打造的精致基本款，尺寸小巧，个性却十分丰盈，优雅而女性化。配有可调节皮质肩带，可单肩背或斜挎。',
  },
  cuff: {
    tr: 'Dana derisinden Petal Cuff çanta. Koleksiyonun tamamındaki tasarım anlayışını taşıyan zarif bir deri aksesuar. Minimal, zarif ve zamansız. Zincir askısıyla omuzda ya da çapraz taşınabilir.',
    en: 'Petal Cuff bag crafted from calfskin. A refined leather accessory reflecting the same design philosophy found throughout the collection. Minimal, elegant and timeless. Features a chain strap for versatile styling as a shoulder or crossbody bag.',
    ru: 'Сумка Petal Cuff из телячьей кожи. Изысканный кожаный аксессуар, отражающий единую философию дизайна всей коллекции. Минималистичная, элегантная и вне времени. Цепочка позволяет носить её на плече или через плечо.',
    nl: 'Petal Cuff-tas van kalfsleer. Een verfijnd leren accessoire in dezelfde ontwerpfilosofie als de hele collectie. Minimaal, elegant en tijdloos. Met een kettingband om over de schouder of crossbody te dragen.',
    de: 'Petal Cuff aus Kalbsleder. Ein raffiniertes Lederaccessoire, das dieselbe Designhaltung trägt wie die gesamte Kollektion. Minimal, elegant und zeitlos. Mit Kettenriemen, über der Schulter oder crossbody zu tragen.',
    fr: 'Sac Petal Cuff en cuir de veau. Un accessoire en cuir raffiné qui reflète la philosophie de toute la collection. Minimal, élégant et intemporel. Sa chaîne permet de le porter à l’épaule ou en travers.',
    it: 'Borsa Petal Cuff in pelle di vitello. Un raffinato accessorio in pelle che riflette la stessa filosofia di design dell’intera collezione. Minimale, elegante e senza tempo. La catena permette di portarla a spalla o a tracolla.',
    es: 'Bolso Petal Cuff de piel de becerro. Un refinado accesorio de piel que refleja la misma filosofía de diseño de toda la colección. Minimalista, elegante y atemporal. Su cadena permite llevarlo al hombro o cruzado.',
    ko: '카프스킨으로 완성한 Petal Cuff 백. 컬렉션 전반의 디자인 철학을 담은 세련된 가죽 액세서리입니다. 미니멀하고 우아하며 시대를 타지 않습니다. 체인 스트랩으로 숄더백이나 크로스바디로 연출할 수 있습니다.',
    ja: 'カーフレザーで仕立てたPetal Cuff。コレクション全体に通じるデザイン哲学を映した、洗練されたレザーアクセサリー。ミニマルでエレガント、そして時代を超える一品。チェーンストラップで、ショルダーにもクロスボディにも。',
    zh: 'Petal Cuff 手袋，采用小牛皮制作。精致的皮革配饰，延续整个系列的设计理念，极简、优雅而经典。配有链条肩带，可单肩背或斜挎。',
  },
  bucket12: {
    tr: 'Dana derisinden Petal Bucket çanta. Gün içinde rahat hareket ve modern yaşam için tasarlanan Petal Bucket’ın kompakt versiyonu. Ayarlanabilir deri askısıyla omuzda ya da çapraz taşınabilir.',
    en: 'Petal Bucket bag crafted from calfskin. A compact version of the Petal Bucket designed for everyday movement and modern lifestyles. Features an adjustable leather strap for versatile styling as a shoulder or crossbody bag.',
    ru: 'Сумка Petal Bucket из телячьей кожи. Компактная версия Petal Bucket для активного дня и современного ритма жизни. Регулируемый кожаный ремень позволяет носить её на плече или через плечо.',
    nl: 'Petal Bucket-tas van kalfsleer. Een compacte versie van de Petal Bucket, gemaakt voor een dag in beweging en een moderne levensstijl. Met een verstelbare leren band om over de schouder of crossbody te dragen.',
    de: 'Petal Bucket aus Kalbsleder. Eine kompakte Version der Petal Bucket für einen bewegten Alltag und modernen Lebensstil. Mit verstellbarem Lederriemen, über der Schulter oder crossbody zu tragen.',
    fr: 'Sac Petal Bucket en cuir de veau. Une version compacte du Petal Bucket, pensée pour bouger au quotidien et pour la vie moderne. Sa bandoulière en cuir réglable permet de le porter à l’épaule ou en travers.',
    it: 'Borsa Petal Bucket in pelle di vitello. Una versione compatta della Petal Bucket, pensata per muoversi ogni giorno e per lo stile di vita moderno. La tracolla in pelle regolabile permette di portarla a spalla o a tracolla.',
    es: 'Bolso Petal Bucket de piel de becerro. Una versión compacta del Petal Bucket, pensada para el movimiento diario y la vida moderna. Su correa de piel ajustable permite llevarlo al hombro o cruzado.',
    ko: '카프스킨으로 완성한 Petal Bucket 백. 일상의 움직임과 현대적인 라이프스타일을 위해 디자인한 Petal Bucket의 콤팩트 버전입니다. 길이 조절이 가능한 가죽 스트랩으로 숄더백이나 크로스바디로 연출할 수 있습니다.',
    ja: 'カーフレザーで仕立てたPetal Bucket。日々の動きとモダンなライフスタイルのためにデザインした、Petal Bucketのコンパクト版。長さを調節できるレザーストラップで、ショルダーにもクロスボディにも。',
    zh: 'Petal Bucket 手袋，采用小牛皮制作。Petal Bucket 的小巧版本，为日常出行与现代生活方式而设计。配有可调节皮质肩带，可单肩背或斜挎。',
  },
  bucket20: {
    tr: 'Dana derisinden Petal Bucket çanta. Klasik kova çantanın çağdaş bir yorumu. İşlevsel, çok yönlü ve zahmetsizce zarif.',
    en: 'Petal Bucket bag crafted from calfskin. A contemporary reinterpretation of the classic bucket bag. Functional, versatile and effortlessly elegant.',
    ru: 'Сумка Petal Bucket из телячьей кожи. Современная интерпретация классической сумки-ведра. Функциональная, универсальная и непринуждённо элегантная.',
    nl: 'Petal Bucket-tas van kalfsleer. Een eigentijdse herinterpretatie van de klassieke buckettas. Functioneel, veelzijdig en moeiteloos elegant.',
    de: 'Petal Bucket aus Kalbsleder. Eine zeitgemäße Neuinterpretation der klassischen Bucket Bag. Funktional, vielseitig und mühelos elegant.',
    fr: 'Sac Petal Bucket en cuir de veau. Une réinterprétation contemporaine du sac seau classique. Fonctionnel, polyvalent et naturellement élégant.',
    it: 'Borsa Petal Bucket in pelle di vitello. Una reinterpretazione contemporanea della classica borsa a secchiello. Funzionale, versatile e di un’eleganza spontanea.',
    es: 'Bolso Petal Bucket de piel de becerro. Una reinterpretación contemporánea del clásico bolso cubo. Funcional, versátil y de una elegancia natural.',
    ko: '카프스킨으로 완성한 Petal Bucket 백. 클래식 버킷백을 현대적으로 재해석했습니다. 실용적이고 다재다능하며 자연스럽게 우아합니다.',
    ja: 'カーフレザーで仕立てたPetal Bucket。クラシックなバケットバッグを現代的に再解釈。機能的で汎用性が高く、さりげなくエレガントです。',
    zh: 'Petal Bucket 手袋，采用小牛皮制作。经典水桶包的当代演绎，实用、百搭，优雅自然。',
  },
};

const SUBTITLE = {
  box: { tr: 'Heykelsi fermuarlı çanta', en: 'Sculptural zip bag', ru: 'Скульптурная сумка на молнии', nl: 'Sculpturale tas met rits', de: 'Skulpturale Reißverschlusstasche', fr: 'Sac sculptural zippé', it: 'Borsa scultorea con zip', es: 'Bolso escultórico con cremallera', ko: '스컬프처럴 지퍼 백', ja: 'スカルプチュラル ジップバッグ', zh: '雕塑感拉链包' },
  shoulder: { tr: 'Omuz çantası', en: 'Shoulder bag', ru: 'Сумка на плечо', nl: 'Schoudertas', de: 'Schultertasche', fr: 'Sac porté épaule', it: 'Borsa a spalla', es: 'Bolso de hombro', ko: '숄더백', ja: 'ショルダーバッグ', zh: '单肩包' },
  crossbody: { tr: 'Fermuarlı çapraz çanta', en: 'Zip crossbody bag', ru: 'Сумка через плечо на молнии', nl: 'Crossbodytas met rits', de: 'Crossbody-Tasche mit Reißverschluss', fr: 'Sac bandoulière zippé', it: 'Borsa a tracolla con zip', es: 'Bolso bandolera con cremallera', ko: '지퍼 크로스바디 백', ja: 'ジップ クロスボディバッグ', zh: '拉链斜挎包' },
  lady: { tr: 'Kulplu kutu çanta', en: 'Top-handle box bag', ru: 'Каркасная сумка с ручками', nl: 'Boxtas met handvatten', de: 'Box-Bag mit Henkeln', fr: 'Sac boîte à poignées', it: 'Borsa a bauletto', es: 'Bolso de mano rígido', ko: '탑 핸들 박스 백', ja: 'トップハンドル ボックスバッグ', zh: '手提方盒包' },
  cuff: { tr: 'Zincirli mini çanta', en: 'Mini chain bag', ru: 'Мини-сумка на цепочке', nl: 'Mini tas met ketting', de: 'Mini-Tasche mit Kette', fr: 'Mini sac à chaîne', it: 'Mini borsa con catena', es: 'Minibolso con cadena', ko: '미니 체인 백', ja: 'ミニ チェーンバッグ', zh: '迷你链条包' },
  bucket: { tr: 'Kova çanta', en: 'Bucket bag', ru: 'Сумка-мешок', nl: 'Buideltas', de: 'Beuteltasche', fr: 'Sac seau', it: 'Borsa a secchiello', es: 'Bolso saco', ko: '버킷백', ja: 'バケットバッグ', zh: '水桶包' },
  bigBucket: { tr: 'Büyük kova çanta', en: 'Large bucket bag', ru: 'Большая сумка-мешок', nl: 'Grote buideltas', de: 'Große Beuteltasche', fr: 'Grand sac seau', it: 'Secchiello grande', es: 'Bolso saco grande', ko: '라지 버킷백', ja: 'ラージ バケットバッグ', zh: '大号水桶包' },
} satisfies Record<string, L>;

/** Canan's line-up and prices (Kasım 2026), in the order of her grid. */
export const PRODUCTS: SeedProduct[] = [
  { slug: 'petal-box-chili', name: 'Petal Box', price: 20000, featured: true, variants: [{ color: 'chili', sku: 'MY-ORI-RED', stock: 3 }], subtitle: SUBTITLE.box, description: COPY.box, dimensions: dims(16, 12.5, 16), material: CALFSKIN, replaces: { slug: 'origami', color: 'red' } },
  { slug: 'petal-shoulder-24-botanic', name: 'Petal Shoulder 24', price: 20000, featured: true, variants: [{ color: 'botanic', sku: 'MY-FRM-GRN', stock: 3 }], subtitle: SUBTITLE.shoulder, description: COPY.shoulder24, dimensions: dims(24, 21, 5.5), material: CALFSKIN, replaces: { slug: 'frame', color: 'green' } },
  { slug: 'petal-shoulder-24-black-moon', name: 'Petal Shoulder 24', price: 20000, featured: true, variants: [{ color: 'black-moon', sku: 'MY-DUO-BIC', stock: 3 }], subtitle: SUBTITLE.shoulder, description: COPY.shoulder24, dimensions: dims(24, 21, 5.5), material: CALFSKIN, replaces: { slug: 'duo', color: 'bicolor' } },
  { slug: 'petal-shoulder-14-black', name: 'Petal Shoulder 14', price: 15000, featured: true, variants: [{ color: 'black', sku: 'MY-CUB-BLK', stock: 3 }], subtitle: SUBTITLE.crossbody, description: COPY.shoulder14, dimensions: dims(14, 14, 5.5), material: CALFSKIN, replaces: { slug: 'cube', color: 'black' } },
  { slug: 'petal-lady-moon', name: 'Petal Lady', price: 20000, featured: true, variants: [{ color: 'moon', sku: 'MY-VAL-IVO', stock: 3 }], subtitle: SUBTITLE.lady, description: COPY.lady, dimensions: dims(20, 14, 6), material: CALFSKIN, replaces: { slug: 'valise', color: 'ivory' } },
  { slug: 'petal-cuff-15-5-black', name: 'Petal Cuff 15.5', price: 15000, featured: true, variants: [{ color: 'black', sku: 'MY-LUN-BLK', stock: 3 }], subtitle: SUBTITLE.cuff, description: COPY.cuff, dimensions: dims(15.5, 14, 6), material: CALFSKIN, replaces: { slug: 'lune', color: 'black' } },
  { slug: 'petal-bucket-12-chili', name: 'Petal Bucket 12', price: 15000, featured: true, variants: [{ color: 'chili', sku: 'MY-TUL-RED', stock: 3 }], subtitle: SUBTITLE.bucket, description: COPY.bucket12, dimensions: dims(12, 15, 12), material: CALFSKIN, replaces: { slug: 'tulip', color: 'red' } },
  { slug: 'petal-bucket-20-botanic', name: 'Petal Bucket 20', price: 22000, featured: true, variants: [{ color: 'botanic', sku: 'MY-DRP-GRN', stock: 3 }], subtitle: SUBTITLE.bigBucket, description: COPY.bucket20, dimensions: dims(20, 24.5, 20), material: CALFSKIN, replaces: { slug: 'drape', color: 'green' } },
];

// ───────── Homepage, Faz 1 additions (diptych, model strip, banner) ─────────
export const HOME_V2: Record<'DIPTYCH' | 'STRIP' | 'BANNER' | 'SIDEWAYS' | 'BOUTIQUE', Record<string, L>> = {
  BOUTIQUE: {
    title: { tr: 'Vitrinde', en: 'On display', ru: 'На витрине', nl: 'In de etalage', de: 'Im Schaufenster', fr: 'En vitrine', it: 'In vetrina', es: 'En el escaparate', ko: '쇼윈도', ja: 'ショーウィンドウ', zh: '橱窗陈列' },
    body: { tr: 'Sekiz model, yan yana.', en: 'Eight models, side by side.', ru: 'Восемь моделей бок о бок.', nl: 'Acht modellen, zij aan zij.', de: 'Acht Modelle, Seite an Seite.', fr: 'Huit modèles, côte à côte.', it: 'Otto modelli, uno accanto all’altro.', es: 'Ocho modelos, uno junto a otro.', ko: '여덟 가지 모델을 한자리에.', ja: '8つのモデルを、ひとつの棚に。', zh: '八款包袋，并排陈列。' },
    ctaLabel: { tr: 'Koleksiyonu keşfet', en: 'Discover the collection', ru: 'Смотреть коллекцию', nl: 'Ontdek de collectie', de: 'Kollektion entdecken', fr: 'Découvrir la collection', it: 'Scopri la collezione', es: 'Descubrir la colección', ko: '컬렉션 보기', ja: 'コレクションを見る', zh: '探索系列' },
  },
  SIDEWAYS: {
    subtitle: { tr: 'Origami, kırmızı', en: 'Origami in red', ru: 'Origami, красный', nl: 'Origami in rood', de: 'Origami in Rot', fr: 'Origami rouge', it: 'Origami rosso', es: 'Origami en rojo', ko: '레드 Origami', ja: 'Origami、レッド', zh: 'Origami 红色' },
    title: { tr: 'Yeni koleksiyon', en: 'New collection', ru: 'Новая коллекция', nl: 'Nieuwe collectie', de: 'Neue Kollektion', fr: 'Nouvelle collection', it: 'Nuova collezione', es: 'Nueva colección', ko: '새 컬렉션', ja: '新コレクション', zh: '新系列' },
    ctaLabel: { tr: 'Keşfet', en: 'Discover', ru: 'Смотреть', nl: 'Ontdek', de: 'Entdecken', fr: 'Découvrir', it: 'Scopri', es: 'Descubrir', ko: '둘러보기', ja: '見る', zh: '探索' },
  },
  DIPTYCH: {
    title: { tr: 'Gündelik heykeller', en: 'Everyday sculptures', ru: 'Скульптуры на каждый день', nl: 'Sculpturen voor elke dag', de: 'Skulpturen für jeden Tag', fr: 'Des sculptures au quotidien', it: 'Sculture di ogni giorno', es: 'Esculturas para cada día', ko: '일상의 조각', ja: '日常の彫刻', zh: '日常的雕塑' },
    body: {
      tr: 'Tek parça deriden katlanarak biçimlenen formlar; her biri İstanbul’daki atölyemizde elde dikilir.',
      en: 'Forms folded from a single piece of leather, each one stitched by hand in our Istanbul atelier.',
      ru: 'Формы, сложенные из цельного куска кожи; каждая сшита вручную в нашей мастерской в Стамбуле.',
      nl: 'Vormen gevouwen uit één stuk leer, elk met de hand gestikt in ons atelier in Istanbul.',
      de: 'Formen, aus einem einzigen Stück Leder gefaltet und in unserem Istanbuler Atelier von Hand genäht.',
      fr: 'Des formes pliées dans une seule pièce de cuir, chacune cousue main dans notre atelier d’Istanbul.',
      it: 'Forme piegate da un unico pezzo di pelle, ognuna cucita a mano nel nostro atelier di Istanbul.',
      es: 'Formas plegadas a partir de una sola pieza de piel, cada una cosida a mano en nuestro taller de Estambul.',
      ko: '한 장의 가죽을 접어 완성한 형태, 이스탄불 아틀리에에서 하나하나 손으로 바느질합니다.',
      ja: '一枚の革を折りたたんで生まれるフォルム。すべてイスタンブールのアトリエで手縫いされています。',
      zh: '由一整块皮革折叠而成的造型，每一只都在我们伊斯坦布尔的工坊手工缝制。',
    },
    ctaLabel: HOME.HERO.ctaLabel,
  },
  STRIP: {
    title: { tr: 'Modeller', en: 'The models', ru: 'Модели', nl: 'De modellen', de: 'Die Modelle', fr: 'Les modèles', it: 'I modelli', es: 'Los modelos', ko: '모델', ja: 'モデル', zh: '款式' },
  },
  BANNER: {
    subtitle: { tr: 'Yeni renk', en: 'New colour', ru: 'Новый цвет', nl: 'Nieuwe kleur', de: 'Neue Farbe', fr: 'Nouvelle couleur', it: 'Nuovo colore', es: 'Nuevo color', ko: '새로운 컬러', ja: '新色', zh: '新色' },
    title: { tr: 'Drape, şişe yeşili', en: 'Drape in bottle green', ru: 'Drape в бутылочно-зелёном', nl: 'Drape in flessengroen', de: 'Drape in Flaschengrün', fr: 'Drape en vert bouteille', it: 'Drape verde bottiglia', es: 'Drape en verde botella', ko: '보틀 그린 Drape', ja: 'Drape、ボトルグリーン', zh: 'Drape 瓶绿色' },
    ctaLabel: HOME.HERO.ctaLabel,
  },
};
