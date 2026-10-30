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

// ───────── Colours ─────────
export const COLORS: { slug: string; hex: string; hex2?: string; name: L }[] = [
  { slug: 'red', hex: '#A3121B', name: { tr: 'Kırmızı', en: 'Red', ru: 'Красный', nl: 'Rood', de: 'Rot', fr: 'Rouge', it: 'Rosso', es: 'Rojo', ko: '레드', ja: 'レッド', zh: '红色' } },
  { slug: 'black', hex: '#141414', name: { tr: 'Siyah', en: 'Black', ru: 'Чёрный', nl: 'Zwart', de: 'Schwarz', fr: 'Noir', it: 'Nero', es: 'Negro', ko: '블랙', ja: 'ブラック', zh: '黑色' } },
  { slug: 'white', hex: '#F2EFEA', name: { tr: 'Beyaz', en: 'White', ru: 'Белый', nl: 'Wit', de: 'Weiß', fr: 'Blanc', it: 'Bianco', es: 'Blanco', ko: '화이트', ja: 'ホワイト', zh: '白色' } },
  { slug: 'green', hex: '#1F3B3A', name: { tr: 'Yeşil', en: 'Green', ru: 'Зелёный', nl: 'Groen', de: 'Grün', fr: 'Vert', it: 'Verde', es: 'Verde', ko: '그린', ja: 'グリーン', zh: '绿色' } },
  { slug: 'bicolor', hex: '#141414', hex2: '#E9E2D6', name: { tr: 'Çift Renk', en: 'Bicolour', ru: 'Двухцветный', nl: 'Tweekleurig', de: 'Zweifarbig', fr: 'Bicolore', it: 'Bicolore', es: 'Bicolor', ko: '바이컬러', ja: 'バイカラー', zh: '双色' } },
  { slug: 'ivory', hex: '#E9E2D6', name: { tr: 'Fildişi', en: 'Ivory', ru: 'Слоновая кость', nl: 'Ivoor', de: 'Elfenbein', fr: 'Ivoire', it: 'Avorio', es: 'Marfil', ko: '아이보리', ja: 'アイボリー', zh: '象牙白' } },
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
  name: string;
  /** Placeholder TRY price (VAT incl.) — set the real one in the admin. */
  price: number;
  featured: boolean;
  /** Variant per colour, in display order; images come from seed-assets/catalog/<slug>/ by colour tag. */
  variants: { color: string; sku: string; stock: number }[];
  subtitle: L;
  description: L;
};

export const PRODUCTS: SeedProduct[] = [
  {
    slug: 'origami',
    name: 'Origami',
    price: 14500,
    featured: true,
    variants: [{ color: 'red', sku: 'MY-ORI-RED', stock: 3 }],
    subtitle: { tr: 'Heykelsi fermuarlı çanta', en: 'Sculptural zip bag', ru: 'Скульптурная сумка на молнии', nl: 'Sculpturale tas met rits', de: 'Skulpturale Reißverschlusstasche', fr: 'Sac sculptural zippé', it: 'Borsa scultorea con zip', es: 'Bolso escultórico con cremallera', ko: '스컬프처럴 지퍼 백', ja: 'スカルプチュラル ジップバッグ', zh: '雕塑感拉链包' },
    description: {
      tr: 'İmza modelimiz: köşe boyunca uzanan fermuarı sayesinde küp formundan piramide dönüşür. Elde ya da askısıyla omuzda taşınır.',
      en: 'Our signature piece: a full-length corner zip lets it shift from cube to pyramid. Carry it by hand or on the shoulder with its strap.',
      ru: 'Наша фирменная модель: молния вдоль всего ребра превращает куб в пирамиду. Носите в руке или на плече с ремнём.',
      nl: 'Ons signatuurmodel: een rits over de volle hoek laat de tas veranderen van kubus in piramide. Draag hem in de hand of met de band over de schouder.',
      de: 'Unser Signature-Modell: Ein durchgehender Eckreißverschluss verwandelt den Würfel in eine Pyramide. In der Hand oder mit dem Riemen über der Schulter zu tragen.',
      fr: 'Notre pièce signature : une zip d’angle sur toute la hauteur le fait passer du cube à la pyramide. À porter à la main ou à l’épaule avec sa bandoulière.',
      it: 'Il nostro modello iconico: una zip lungo tutto lo spigolo lo trasforma da cubo a piramide. Da portare a mano o a spalla con la sua tracolla.',
      es: 'Nuestra pieza insignia: una cremallera en toda la arista lo transforma de cubo en pirámide. Llévalo en la mano o al hombro con su correa.',
      ko: '메이야의 시그니처: 모서리를 따라 이어지는 지퍼로 큐브에서 피라미드 형태로 변합니다. 손에 들거나 스트랩으로 어깨에 멜 수 있습니다.',
      ja: 'メイヤのシグネチャー。角に沿って走るジッパーで、キューブからピラミッドへと形を変えます。手持ちでも、ストラップで肩掛けでも。',
      zh: '品牌标志款：贯穿整条边角的拉链让它在立方体与金字塔形之间变换。可手提，也可配肩带单肩背。',
    },
  },
  {
    slug: 'valise',
    name: 'Valise',
    price: 13500,
    featured: true,
    variants: [{ color: 'ivory', sku: 'MY-VAL-IVO', stock: 3 }],
    subtitle: { tr: 'Kulplu kutu çanta', en: 'Top-handle box bag', ru: 'Каркасная сумка с ручками', nl: 'Boxtas met handvatten', de: 'Box-Bag mit Henkeln', fr: 'Sac boîte à poignées', it: 'Borsa a bauletto', es: 'Bolso de mano rígido', ko: '탑 핸들 박스 백', ja: 'トップハンドル ボックスバッグ', zh: '手提方盒包' },
    description: {
      tr: 'Çevresini saran fermuarı ve yuvarlatılmış kulplarıyla yapılandırılmış bir kutu form. Çıkarılabilir askısıyla çapraz da taşınabilir.',
      en: 'A structured box with a wraparound zip and rounded top handles. Add the removable strap to wear it crossbody.',
      ru: 'Структурная форма с круговой молнией и округлыми ручками. Со съёмным ремнём её можно носить через плечо.',
      nl: 'Een gestructureerde box met rondlopende rits en afgeronde handvatten. Met de afneembare band draag je hem crossbody.',
      de: 'Eine strukturierte Box mit umlaufendem Reißverschluss und abgerundeten Henkeln. Mit dem abnehmbaren Riemen auch crossbody zu tragen.',
      fr: 'Une forme boîte structurée, zip tout autour et poignées arrondies. Ajoutez la bandoulière amovible pour la porter en travers.',
      it: 'Una forma strutturata con zip perimetrale e manici arrotondati. Con la tracolla removibile si porta anche a tracolla.',
      es: 'Una caja estructurada con cremallera envolvente y asas redondeadas. Con la correa extraíble se lleva también cruzado.',
      ko: '둘레를 감싸는 지퍼와 둥근 핸들을 갖춘 구조적인 박스 백. 탈착식 스트랩으로 크로스바디로도 연출할 수 있습니다.',
      ja: 'ぐるりと開くジッパーと丸みのあるハンドルを備えた、構築的なボックスシルエット。付属のストラップでクロスボディにも。',
      zh: '环绕式拉链搭配圆润提手的硬挺方盒造型。加上可拆卸肩带即可斜挎。',
    },
  },
  {
    slug: 'duo',
    name: 'Duo',
    price: 12500,
    featured: true,
    variants: [
      { color: 'bicolor', sku: 'MY-DUO-BIC', stock: 3 },
      { color: 'green', sku: 'MY-DUO-GRN', stock: 3 },
    ],
    subtitle: { tr: 'Omuz çantası', en: 'Shoulder bag', ru: 'Сумка на плечо', nl: 'Schoudertas', de: 'Schultertasche', fr: 'Sac porté épaule', it: 'Borsa a spalla', es: 'Bolso de hombro', ko: '숄더백', ja: 'ショルダーバッグ', zh: '单肩包' },
    description: {
      tr: 'Yan kenarı boyunca açılan fermuarlı, sade hatlı bir omuz çantası. Çift renk modelde bir yüzü krem, diğer yüzü siyah.',
      en: 'A clean-lined shoulder bag that opens along its side seam. The bicolour version pairs a cream face with a black one.',
      ru: 'Лаконичная сумка на плечо с молнией вдоль бокового шва. В двухцветной версии одна сторона кремовая, другая — чёрная.',
      nl: 'Een strakke schoudertas die opent langs de zijnaad. De tweekleurige versie combineert een crèmekleurige en een zwarte zijde.',
      de: 'Eine klar geschnittene Schultertasche, die sich entlang der Seitennaht öffnet. Die zweifarbige Version kombiniert eine cremefarbene mit einer schwarzen Seite.',
      fr: 'Un sac épaule aux lignes épurées qui s’ouvre le long de la couture latérale. La version bicolore associe une face crème à une face noire.',
      it: 'Una borsa a spalla dalle linee pulite che si apre lungo la cucitura laterale. La versione bicolore abbina un lato crema a uno nero.',
      es: 'Un bolso de hombro de líneas limpias que se abre a lo largo de la costura lateral. La versión bicolor combina una cara crema y otra negra.',
      ko: '옆 솔기를 따라 열리는 깔끔한 라인의 숄더백. 바이컬러는 한 면은 크림, 다른 면은 블랙입니다.',
      ja: 'サイドに沿って開く、すっきりとしたラインのショルダーバッグ。バイカラーは片面がクリーム、もう片面がブラック。',
      zh: '沿侧缝开合的简洁单肩包。双色款一面为奶油色，另一面为黑色。',
    },
  },
  {
    slug: 'tulip',
    name: 'Tulip',
    price: 9900,
    featured: true,
    variants: [{ color: 'red', sku: 'MY-TUL-RED', stock: 3 }],
    subtitle: { tr: 'Kova çanta', en: 'Bucket bag', ru: 'Сумка-мешок', nl: 'Buideltas', de: 'Beuteltasche', fr: 'Sac seau', it: 'Borsa a secchiello', es: 'Bolso saco', ko: '버킷백', ja: 'バケットバッグ', zh: '水桶包' },
    description: {
      tr: 'Tek kulplu, yumuşak hatlı bir kova çanta. Çıkarılabilir uzun askısıyla omuzda ya da çapraz taşınabilir.',
      en: 'A softly shaped bucket bag with a single top handle. A removable long strap lets you wear it on the shoulder or crossbody.',
      ru: 'Мягкая сумка-мешок с одной ручкой. Съёмный длинный ремень позволяет носить её на плече или через плечо.',
      nl: 'Een zacht gevormde buideltas met één handvat. Met de afneembare lange band draag je hem over de schouder of crossbody.',
      de: 'Eine weich geformte Beuteltasche mit einem Henkel. Mit dem abnehmbaren langen Riemen über der Schulter oder crossbody zu tragen.',
      fr: 'Un sac seau aux formes souples, doté d’une seule poignée. Sa longue bandoulière amovible permet de le porter à l’épaule ou en travers.',
      it: 'Una borsa a secchiello dalle forme morbide con un unico manico. La lunga tracolla removibile permette di portarla a spalla o a tracolla.',
      es: 'Un bolso saco de formas suaves con una sola asa. Su correa larga extraíble permite llevarlo al hombro o cruzado.',
      ko: '부드러운 실루엣의 원 핸들 버킷백. 탈착식 롱 스트랩으로 숄더 또는 크로스바디로 멜 수 있습니다.',
      ja: 'やわらかなフォルムのワンハンドル バケットバッグ。取り外し可能なロングストラップで、肩掛けにも斜め掛けにも。',
      zh: '线条柔和的单提手水桶包。可拆卸长肩带，单肩或斜挎皆宜。',
    },
  },
  {
    slug: 'drape',
    name: 'Drape',
    price: 12900,
    featured: false,
    variants: [{ color: 'green', sku: 'MY-DRP-GRN', stock: 3 }],
    subtitle: { tr: 'Büyük kova çanta', en: 'Large bucket bag', ru: 'Большая сумка-мешок', nl: 'Grote buideltas', de: 'Große Beuteltasche', fr: 'Grand sac seau', it: 'Secchiello grande', es: 'Bolso saco grande', ko: '라지 버킷백', ja: 'ラージ バケットバッグ', zh: '大号水桶包' },
    description: {
      tr: 'Tek parça geniş askısı ve ferah iç hacmiyle her gün için tasarlanmış büyük bir kova çanta. Deri, kullandıkça yumuşayıp dökümlü bir form alır.',
      en: 'A generous bucket bag with a single wide strap, made for every day. The leather softens and drapes as it is carried.',
      ru: 'Вместительная сумка-мешок с одним широким ремнём для каждого дня. Со временем кожа становится мягче и красиво драпируется.',
      nl: 'Een ruime buideltas met één brede band, gemaakt voor elke dag. Het leer wordt zachter en valt soepeler naarmate je hem draagt.',
      de: 'Eine großzügige Beuteltasche mit einem breiten Riemen für jeden Tag. Das Leder wird mit dem Tragen weicher und fällt fließend.',
      fr: 'Un grand sac seau à large anse unique, pensé pour tous les jours. Le cuir s’assouplit et prend un tombé fluide au fil du temps.',
      it: 'Un secchiello capiente con un’unica tracolla larga, pensato per ogni giorno. La pelle si ammorbidisce e si drappeggia con l’uso.',
      es: 'Un amplio bolso saco con una sola asa ancha, pensado para el día a día. La piel se suaviza y cae con naturalidad con el uso.',
      ko: '넓은 원 스트랩과 넉넉한 수납력을 갖춘 데일리 버킷백. 사용할수록 가죽이 부드러워지며 자연스러운 드레이프가 생깁니다.',
      ja: '幅広のワンストラップと余裕のある収納力を備えた、毎日のためのバケットバッグ。使うほどに革がやわらぎ、美しいドレープが生まれます。',
      zh: '宽肩带、大容量的日常水桶包。皮革越用越柔软，自然垂坠。',
    },
  },
  {
    slug: 'frame',
    name: 'Frame',
    price: 9500,
    featured: false,
    variants: [{ color: 'green', sku: 'MY-FRM-GRN', stock: 3 }],
    subtitle: { tr: 'Fermuarlı çapraz çanta', en: 'Zip crossbody bag', ru: 'Сумка через плечо на молнии', nl: 'Crossbodytas met rits', de: 'Crossbody-Tasche mit Reißverschluss', fr: 'Sac bandoulière zippé', it: 'Borsa a tracolla con zip', es: 'Bolso bandolera con cremallera', ko: '지퍼 크로스바디 백', ja: 'ジップ クロスボディバッグ', zh: '拉链斜挎包' },
    description: {
      tr: 'Üst kenarı saran fermuarı ve yaprak formlu çekeceleriyle kompakt bir çapraz çanta. İnce, ayarlanabilir askı.',
      en: 'A compact crossbody with a wraparound top zip and leaf-shaped pulls, on a slim adjustable strap.',
      ru: 'Компактная сумка через плечо с молнией по верхнему краю и бегунками в форме листьев, на тонком регулируемом ремне.',
      nl: 'Een compacte crossbodytas met rondlopende rits en bladvormige treklipjes, aan een smalle verstelbare band.',
      de: 'Eine kompakte Crossbody-Tasche mit umlaufendem Reißverschluss und blattförmigen Zippern, an einem schmalen verstellbaren Riemen.',
      fr: 'Un sac bandoulière compact, zip enveloppant et tirettes en forme de feuille, sur une fine bandoulière réglable.',
      it: 'Una borsa a tracolla compatta con zip avvolgente e tiretti a foglia, su una sottile tracolla regolabile.',
      es: 'Un bolso bandolera compacto con cremallera envolvente y tiradores en forma de hoja, con correa fina ajustable.',
      ko: '상단을 감싸는 지퍼와 잎사귀 모양 지퍼 풀러를 갖춘 컴팩트한 크로스바디 백. 슬림한 길이 조절 스트랩.',
      ja: '上部をぐるりと囲むジッパーとリーフ型の引き手が特徴のコンパクトなクロスボディ。細身の調節可能なストラップ付き。',
      zh: '环绕式顶部拉链搭配叶片造型拉头的小巧斜挎包，配细款可调节肩带。',
    },
  },
  {
    slug: 'cube',
    name: 'Cube',
    price: 8900,
    featured: false,
    variants: [{ color: 'black', sku: 'MY-CUB-BLK', stock: 3 }],
    subtitle: { tr: 'Mini kutu çanta', en: 'Mini box bag', ru: 'Мини-сумка-коробка', nl: 'Mini boxtas', de: 'Mini-Box-Bag', fr: 'Mini sac boîte', it: 'Mini borsa box', es: 'Minibolso caja', ko: '미니 박스 백', ja: 'ミニ ボックスバッグ', zh: '迷你方盒包' },
    description: {
      tr: 'Dikey hatlı, kompakt bir kutu çanta. Kavisli fermuar, yaprak formlu çekeceler ve ince, ayarlanabilir askı.',
      en: 'A compact, upright box bag with a curved zip, leaf-shaped pulls and a slim adjustable strap.',
      ru: 'Компактная вертикальная сумка-коробка с изогнутой молнией, бегунками в форме листьев и тонким регулируемым ремнём.',
      nl: 'Een compacte, rechtopstaande boxtas met gebogen rits, bladvormige treklipjes en een smalle verstelbare band.',
      de: 'Eine kompakte, aufrechte Box-Bag mit geschwungenem Reißverschluss, blattförmigen Zippern und schmalem verstellbarem Riemen.',
      fr: 'Un sac boîte compact à la silhouette verticale, zip arrondi, tirettes en forme de feuille et fine bandoulière réglable.',
      it: 'Una borsa box compatta e verticale con zip curva, tiretti a foglia e sottile tracolla regolabile.',
      es: 'Un bolso caja compacto y vertical con cremallera curva, tiradores en forma de hoja y correa fina ajustable.',
      ko: '곡선형 지퍼, 잎사귀 모양 풀러, 슬림한 길이 조절 스트랩을 갖춘 세로형 컴팩트 박스 백.',
      ja: 'カーブしたジッパー、リーフ型の引き手、細身の調節可能なストラップを備えた縦長のコンパクトなボックスバッグ。',
      zh: '竖版小巧方盒包，弧形拉链、叶片造型拉头，配细款可调节肩带。',
    },
  },
  {
    slug: 'lune',
    name: 'Lune',
    price: 7900,
    featured: false,
    variants: [{ color: 'black', sku: 'MY-LUN-BLK', stock: 3 }],
    subtitle: { tr: 'Zincirli mini çanta', en: 'Mini chain bag', ru: 'Мини-сумка на цепочке', nl: 'Mini tas met ketting', de: 'Mini-Tasche mit Kette', fr: 'Mini sac à chaîne', it: 'Mini borsa con catena', es: 'Minibolso con cadena', ko: '미니 체인 백', ja: 'ミニ チェーンバッグ', zh: '迷你链条包' },
    description: {
      tr: 'Yarım ay formunda bir mini çanta. Düğümlü deri kulp ve altın tonlu zincir askıyla gelir.',
      en: 'A half-moon mini bag with a knotted leather handle and a gold-tone chain strap.',
      ru: 'Мини-сумка в форме полумесяца с завязанной кожаной ручкой и цепочкой золотистого цвета.',
      nl: 'Een halvemaanvormige mini tas met geknoopt leren handvat en goudkleurige ketting.',
      de: 'Eine Mini-Tasche in Halbmondform mit geknotetem Lederhenkel und goldfarbener Kette.',
      fr: 'Un mini sac en demi-lune, poignée en cuir nouée et chaîne dorée.',
      it: 'Una mini borsa a mezzaluna con manico in pelle annodato e catena color oro.',
      es: 'Un minibolso en forma de media luna con asa de piel anudada y cadena en tono dorado.',
      ko: '매듭 가죽 핸들과 골드 톤 체인 스트랩을 갖춘 반달 모양 미니 백.',
      ja: '結んだレザーハンドルとゴールドトーンのチェーンストラップを備えた、半月形のミニバッグ。',
      zh: '半月造型迷你包，配打结皮革提手与金色链条肩带。',
    },
  },
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
