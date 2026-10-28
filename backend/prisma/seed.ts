/* Idempotent seed: safe to run on every deploy. Run with `npm run db:seed`. */
import 'dotenv/config';
import { HomeSectionType, PrismaClient, ProductStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const COLORS = [
  { slug: 'red', name: 'Kırmızı', hex: '#A3121B', en: 'Red' },
  { slug: 'black', name: 'Siyah', hex: '#141414', en: 'Black' },
  { slug: 'white', name: 'Beyaz', hex: '#F2EFEA', en: 'White' },
  { slug: 'green', name: 'Yeşil', hex: '#2F4A36', en: 'Green' },
  { slug: 'bicolor', name: 'Çift Renk', hex: '#141414', hex2: '#A3121B', en: 'Bicolor' },
];

const LEGAL_PAGES = [
  { slug: 'about', title: 'Hakkımızda', en: 'About' },
  { slug: 'shipping-returns', title: 'Kargo ve İade', en: 'Shipping & Returns' },
  { slug: 'distance-sales-agreement', title: 'Mesafeli Satış Sözleşmesi', en: 'Distance Sales Agreement' },
  { slug: 'preliminary-information', title: 'Ön Bilgilendirme Formu', en: 'Preliminary Information Form' },
  { slug: 'kvkk', title: 'KVKK Aydınlatma Metni', en: 'Personal Data Notice' },
  { slug: 'privacy', title: 'Gizlilik ve Çerez Politikası', en: 'Privacy & Cookie Policy' },
  { slug: 'terms', title: 'Kullanım Koşulları', en: 'Terms of Use' },
  { slug: 'care', title: 'Deri Bakım Rehberi', en: 'Leather Care Guide' },
];

async function main() {
  // ── Admin
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production' && email && (!password || password.length < 15 || /changeme/i.test(password))) {
    throw new Error('SEED_ADMIN_PASSWORD prod için güçlü olmalı (≥15 karakter, örnek değer değil)');
  }
  if (email && password) {
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        firstName: 'Maeyja',
        lastName: 'Admin',
        role: UserRole.SUPER_ADMIN,
        emailVerifiedAt: new Date(),
      },
      update: {}, // never reset an existing admin's password from the seed
    });
    console.log(`✓ super admin: ${email}`);
  }

  // ── Colours
  for (const [i, c] of COLORS.entries()) {
    await prisma.color.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, hex: c.hex, hex2: c.hex2, sortOrder: i, translations: { en: { name: c.en } } },
      update: {},
    });
  }
  const colors = Object.fromEntries((await prisma.color.findMany()).map((c) => [c.slug, c]));

  // ── Taxonomy
  const bags = await prisma.category.upsert({
    where: { slug: 'bags' },
    create: { slug: 'bags', name: 'Çantalar', sortOrder: 0, translations: { en: { name: 'Bags' } } },
    update: {},
  });
  await prisma.category.upsert({
    where: { slug: 'ready-to-wear' },
    create: { slug: 'ready-to-wear', name: 'Giyim', sortOrder: 1, isActive: false, translations: { en: { name: 'Ready-to-wear' } } },
    update: {},
  });
  const signature = await prisma.collection.upsert({
    where: { slug: 'signature' },
    create: {
      slug: 'signature',
      name: 'Signature',
      description: 'İstanbul’da elde üretilen, heykelsi formlu ikonik çanta.',
      translations: { en: { description: 'The sculptural icon, handcrafted in Istanbul.' } },
    },
    update: {},
  });

  // ── The bag (placeholder price and copy — edit from the admin panel)
  const existing = await prisma.product.findUnique({ where: { slug: 'maeyja-signature-bag' } });
  if (!existing) {
    await prisma.product.create({
      data: {
        slug: 'maeyja-signature-bag',
        name: 'Signature Bag',
        subtitle: 'El yapımı dana derisi',
        description: 'Tek parça deriden şekillendirilen heykelsi form. Gizli fermuar detayı, ayarlanamaz omuz askısı.',
        story: 'Her çanta İstanbul’daki atölyemizde usta zanaatkârlar tarafından elde kesilip dikilir. Bir çantanın tamamlanması yaklaşık iki gün sürer.',
        material: '%100 dana derisi, iç astar süet',
        care: 'Doğrudan güneş ışığından ve nemden uzak tutun. Kendi toz torbasında saklayın.',
        dimensions: '32 × 24 × 12 cm · askı 58 cm',
        madeIn: 'İstanbul, Türkiye',
        status: ProductStatus.ACTIVE,
        isFeatured: true,
        basePrice: 14500,
        taxRate: 20,
        categoryId: bags.id,
        tags: ['bag', 'leather', 'signature', 'canta'],
        publishedAt: new Date(),
        translations: {
          en: {
            subtitle: 'Handcrafted calf leather',
            description: 'A sculptural form shaped from a single piece of leather. Hidden zip detail, fixed shoulder strap.',
            story: 'Every bag is hand-cut and stitched by master artisans in our Istanbul atelier. Each piece takes about two days to complete.',
            material: '100% calf leather, suede lining',
            care: 'Keep away from direct sunlight and moisture. Store in its dust bag.',
            madeIn: 'Istanbul, Türkiye',
          },
        },
        variants: {
          create: [
            { sku: 'MY-SIG-RED', colorId: colors.red.id, stock: 6, sortOrder: 0 },
            { sku: 'MY-SIG-BLK', colorId: colors.black.id, stock: 4, sortOrder: 1 },
            { sku: 'MY-SIG-WHT', colorId: colors.white.id, stock: 3, sortOrder: 2 },
            { sku: 'MY-SIG-GRN', colorId: colors.green.id, stock: 0, sortOrder: 3 },
            { sku: 'MY-SIG-BIC', colorId: colors.bicolor.id, price: 15500, stock: 2, sortOrder: 4 },
          ],
        },
        collections: { create: [{ collectionId: signature.id }] },
      },
    });
    console.log('✓ product: Signature Bag (placeholder price — update in admin)');
  }

  // ── Settings
  await prisma.setting.upsert({
    where: { key: 'shipping' },
    create: { key: 'shipping', value: { flatRate: 0, freeShippingThreshold: 0, estimatedDays: '1-3' } },
    update: {},
  });

  // ── Pages
  for (const p of LEGAL_PAGES) {
    await prisma.page.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, title: p.title, body: `<p>${p.title} metni buraya gelecek.</p>`, translations: { en: { title: p.en } } },
      update: {},
    });
  }

  // ── Press & stockists
  if (!(await prisma.pressItem.count())) {
    await prisma.pressItem.create({
      data: { publication: 'Vogue Türkiye', title: 'Ayrı zevkler, zengin renkler', quote: 'El işçiliğiyle şekillenen heykelsi bir form.', sortOrder: 0 },
    });
  }
  if (!(await prisma.stockist.count())) {
    await prisma.stockist.create({ data: { name: 'Beymen İstinye Park', city: 'İstanbul', address: 'İstinye Park AVM, Sarıyer', sortOrder: 0 } });
  }

  // ── FAQ
  if (!(await prisma.faq.count())) {
    await prisma.faq.createMany({
      data: [
        { group: 'Sipariş', question: 'Siparişim ne zaman kargoya verilir?', answer: 'Stoktaki ürünler 1–3 iş günü içinde kargoya verilir.', sortOrder: 0 },
        { group: 'İade', question: 'İade süresi kaç gün?', answer: 'Teslimattan itibaren 14 gün içinde iade talebi oluşturabilirsiniz.', sortOrder: 1 },
        { group: 'Bakım', question: 'Deri çantamı nasıl temizlerim?', answer: 'Kuru, yumuşak bir bezle silin; kimyasal temizleyici kullanmayın.', sortOrder: 2 },
      ],
    });
  }

  // ── Homepage
  if (!(await prisma.homeSection.count())) {
    await prisma.homeSection.createMany({
      data: [
        {
          type: HomeSectionType.HERO,
          title: 'Hand crafted elegance.',
          subtitle: 'İstanbul’da elde üretildi.',
          ctaLabel: 'Keşfet',
          ctaUrl: '/products/maeyja-signature-bag',
          sortOrder: 0,
          translations: { en: { subtitle: 'Handmade in Istanbul.', ctaLabel: 'Discover' } },
        },
        { type: HomeSectionType.FEATURED_PRODUCTS, title: 'Signature', sortOrder: 1, payload: { limit: 4 } },
        {
          type: HomeSectionType.CRAFT_STORY,
          title: 'Atölyeden',
          body: 'Tek parça deri, iki gün süren el işçiliği ve sayılı üretim.',
          ctaLabel: 'Hikâyemiz',
          ctaUrl: '/about',
          sortOrder: 2,
          translations: { en: { title: 'From the atelier', body: 'A single piece of leather, two days of handwork, limited production.', ctaLabel: 'Our story' } },
        },
        { type: HomeSectionType.PRESS, title: 'Basında', sortOrder: 3, translations: { en: { title: 'Press' } } },
        { type: HomeSectionType.STOCKISTS, title: 'Satış Noktaları', sortOrder: 4, translations: { en: { title: 'Stockists' } } },
        { type: HomeSectionType.NEWSLETTER, title: 'Yeni koleksiyonlardan ilk siz haberdar olun', sortOrder: 5, translations: { en: { title: 'Be the first to know' } } },
      ],
    });
  }

  console.log('✓ seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
