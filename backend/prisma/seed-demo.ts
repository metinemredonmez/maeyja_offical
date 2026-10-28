/**
 * Demo records so every admin screen has an example to look at:
 *   npm run db:seed:demo              add (skipped if already there)
 *   npm run db:seed:demo -- --remove  delete every demo record again
 * Everything is marked: orders MY-DEMO-*, people *.demo@example.com (example.com never receives mail),
 * coupon DEMO10 (inactive), journal/collection slugs demo-*, campaign subjects "[DEMO] …".
 * Writes straight to the database: no emails are sent and product stock is not touched.
 * Run after `npm run db:seed:catalog` (orders use the real products).
 */
import 'dotenv/config';
import { CampaignAudience, ContentStatus, CouponType, OrderStatus, PaymentProvider, PaymentStatus, Prisma, PrismaClient, ReturnStatus, UserRole } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_EMAIL = '.demo@example.com';
const day = (n: number) => new Date(Date.now() - n * 86_400_000);

async function remove() {
  const [orders, users] = await Promise.all([
    prisma.order.deleteMany({ where: { orderNumber: { startsWith: 'MY-DEMO-' } } }),
    prisma.user.deleteMany({ where: { email: { endsWith: DEMO_EMAIL }, role: UserRole.CUSTOMER } }),
  ]);
  await prisma.$transaction([
    prisma.coupon.deleteMany({ where: { code: 'DEMO10' } }),
    prisma.journalPost.deleteMany({ where: { slug: { startsWith: 'demo-' } } }),
    prisma.collection.deleteMany({ where: { slug: { startsWith: 'demo-' } } }),
    prisma.contactMessage.deleteMany({ where: { email: { endsWith: DEMO_EMAIL } } }),
    prisma.newsletterSubscriber.deleteMany({ where: { email: { endsWith: DEMO_EMAIL } } }),
    prisma.stockAlert.deleteMany({ where: { email: { endsWith: DEMO_EMAIL } } }),
    prisma.emailCampaign.deleteMany({ where: { subject: { startsWith: '[DEMO]' } } }),
  ]);
  console.log(`✓ demo silindi (${orders.count} sipariş, ${users.count} müşteri ve diğer örnekler)`);
}

async function add() {
  if (await prisma.order.findFirst({ where: { orderNumber: { startsWith: 'MY-DEMO-' } } })) {
    console.log('– demo veriler zaten var (silmek için: npm run db:seed:demo -- --remove)');
    return;
  }
  const products = await prisma.product.findMany({
    where: { slug: { in: ['origami', 'tulip', 'lune', 'duo'] } },
    include: { variants: { include: { color: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  });
  const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));
  if (products.length < 4) throw new Error('Önce `npm run db:seed:catalog` çalıştırın (demo siparişler gerçek ürünleri kullanır)');

  // ── Customers (no password → they cannot sign in)
  const elif = await prisma.user.create({
    data: {
      email: `elif${DEMO_EMAIL}`,
      firstName: 'Elif',
      lastName: 'Yılmaz (demo)',
      phone: '+905550000001',
      locale: 'tr',
      marketingOptIn: true,
      emailVerifiedAt: day(30),
      createdAt: day(30),
      addresses: { create: { title: 'Ev', firstName: 'Elif', lastName: 'Yılmaz', phone: '+905550000001', city: 'İstanbul', district: 'Beşiktaş', line1: 'Örnek Mah. Demo Sk. No: 1 D: 2', postalCode: '34353', isDefault: true } },
      wishlist: { create: { productId: bySlug.duo.id } },
    },
  });
  const john = await prisma.user.create({
    data: { email: `john${DEMO_EMAIL}`, firstName: 'John', lastName: 'Smith (demo)', locale: 'en', marketingOptIn: false, emailVerifiedAt: day(12), createdAt: day(12) },
  });

  const address = (first: string, last: string, phone: string, city: string, district: string, line1: string) => ({ firstName: first, lastName: last, phone, country: 'TR', city, district, line1 });
  const elifAddress = address('Elif', 'Yılmaz', '+905550000001', 'İstanbul', 'Beşiktaş', 'Örnek Mah. Demo Sk. No: 1 D: 2');
  const johnAddress = address('John', 'Smith', '+905550000002', 'İzmir', 'Konak', 'Demo Cad. No: 10');

  const line = (slug: string, quantity = 1) => {
    const p = bySlug[slug];
    const v = p.variants[0];
    const unit = Number(v.price ?? p.basePrice);
    return { productId: p.id, variantId: v.id, productName: p.name, variantName: v.color?.name ?? null, sku: v.sku, colorName: v.color?.name ?? null, imageUrl: p.images[0]?.url ?? null, unitPrice: unit, quantity, lineTotal: unit * quantity, taxRate: p.taxRate ?? 20 };
  };
  const totals = (items: { lineTotal: number }[], discount = 0) => {
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const total = subtotal - discount;
    return { subtotal, discountTotal: discount, shippingTotal: 0, total, taxTotal: Math.round((total * 20) / 120 * 100) / 100 };
  };

  // ── Coupon (inactive so nobody can use it on the live shop)
  const coupon = await prisma.coupon.create({
    data: { code: 'DEMO10', description: 'Demo kupon — %10 (pasif)', type: CouponType.PERCENT, value: 10, usageLimitPerUser: 1, usedCount: 1, isActive: false },
  });

  // ── Orders: delivered (+ return request), shipped, awaiting bank transfer
  const delivered = [line('origami')];
  const dTotals = totals(delivered, 1450);
  const o1 = await prisma.order.create({
    data: {
      orderNumber: 'MY-DEMO-0001',
      userId: elif.id,
      email: elif.email,
      phone: elifAddress.phone,
      status: OrderStatus.DELIVERED,
      ...dTotals,
      couponCode: coupon.code,
      paymentProvider: PaymentProvider.IYZICO,
      shippingAddress: elifAddress,
      billingAddress: { ...elifAddress, invoiceType: 'INDIVIDUAL' },
      customerNote: 'Hediye paketi olabilir mi? (demo)',
      adminNote: 'DEMO sipariş — gerçek değil',
      carrier: 'Aras Kargo',
      trackingNumber: 'DEMO123456',
      createdAt: day(9),
      paidAt: day(9),
      shippedAt: day(8),
      deliveredAt: day(6),
      items: { create: delivered },
      payments: { create: { provider: PaymentProvider.IYZICO, status: PaymentStatus.SUCCEEDED, amount: dTotals.total, cardLast4: '0000', cardAssociation: 'MASTER_CARD', installment: 1, createdAt: day(9) } },
      history: {
        create: [
          { from: null, to: OrderStatus.PENDING_PAYMENT, note: 'Sipariş oluşturuldu', createdAt: day(9) },
          { from: OrderStatus.PENDING_PAYMENT, to: OrderStatus.PAID, note: 'Kartla ödendi', createdAt: day(9) },
          { from: OrderStatus.PAID, to: OrderStatus.SHIPPED, note: 'Aras Kargo DEMO123456', createdAt: day(8) },
          { from: OrderStatus.SHIPPED, to: OrderStatus.DELIVERED, createdAt: day(6) },
        ],
      },
      couponRedemption: { create: { couponId: coupon.id, email: elif.email, createdAt: day(9) } },
    },
    include: { items: true },
  });
  await prisma.returnRequest.create({
    data: { orderId: o1.id, userId: elif.id, email: elif.email, reason: 'Rengi beklediğimden farklı geldi (demo).', items: [{ orderItemId: o1.items[0].id, quantity: 1 }], status: ReturnStatus.REQUESTED, createdAt: day(4) },
  });

  const shipped = [line('tulip'), line('lune')];
  const sTotals = totals(shipped);
  await prisma.order.create({
    data: {
      orderNumber: 'MY-DEMO-0002',
      userId: john.id,
      email: john.email,
      phone: johnAddress.phone,
      status: OrderStatus.SHIPPED,
      ...sTotals,
      paymentProvider: PaymentProvider.IYZICO,
      shippingAddress: johnAddress,
      billingAddress: { ...johnAddress, invoiceType: 'INDIVIDUAL' },
      locale: 'en',
      adminNote: 'DEMO sipariş — gerçek değil',
      carrier: 'Yurtiçi Kargo',
      trackingNumber: 'DEMO654321',
      createdAt: day(3),
      paidAt: day(3),
      shippedAt: day(2),
      items: { create: shipped },
      payments: { create: { provider: PaymentProvider.IYZICO, status: PaymentStatus.SUCCEEDED, amount: sTotals.total, cardLast4: '0000', cardAssociation: 'VISA', installment: 3, createdAt: day(3) } },
      history: {
        create: [
          { from: null, to: OrderStatus.PENDING_PAYMENT, note: 'Sipariş oluşturuldu', createdAt: day(3) },
          { from: OrderStatus.PENDING_PAYMENT, to: OrderStatus.PAID, note: 'Kartla ödendi (3 taksit)', createdAt: day(3) },
          { from: OrderStatus.PAID, to: OrderStatus.SHIPPED, note: 'Yurtiçi Kargo DEMO654321', createdAt: day(2) },
        ],
      },
    },
  });

  // Guest order paying by bank transfer (left out of the 48 h auto-cancel by being fresh).
  const pending = [line('duo')];
  const pTotals = totals(pending);
  const guestAddress = address('Zeynep', 'Kaya', '+905550000003', 'Ankara', 'Çankaya', 'Demo Bulvarı No: 5');
  await prisma.order.create({
    data: {
      orderNumber: 'MY-DEMO-0003',
      email: `zeynep${DEMO_EMAIL}`,
      phone: guestAddress.phone,
      status: OrderStatus.PENDING_PAYMENT,
      ...pTotals,
      paymentProvider: PaymentProvider.BANK_TRANSFER,
      shippingAddress: guestAddress,
      billingAddress: { ...guestAddress, invoiceType: 'INDIVIDUAL' },
      adminNote: 'DEMO sipariş — gerçek değil (misafir, havale bekliyor)',
      items: { create: pending },
      payments: { create: { provider: PaymentProvider.BANK_TRANSFER, status: PaymentStatus.PENDING, amount: pTotals.total } },
      history: { create: [{ from: null, to: OrderStatus.PENDING_PAYMENT, note: 'Havale bekleniyor' }] },
    },
  });

  // ── Content & marketing
  const cover = bySlug.origami.images[0]?.url ?? null;
  await prisma.journalPost.create({
    data: {
      slug: 'demo-origami-hikayesi',
      title: 'Atölyeden: Origami’nin hikâyesi (demo)',
      excerpt: 'Tek bir fermuarla küpten piramide dönüşen formun ortaya çıkışı.',
      body: '<p>Bu bir <strong>örnek</strong> journal yazısıdır. Taslak olarak kaydedildi; sitede görünmez.</p><h2>Form</h2><p>Köşe boyunca uzanan fermuar…</p>',
      coverImageUrl: cover,
      status: ContentStatus.DRAFT,
    },
  });
  await prisma.collection.create({
    data: { slug: 'demo-siyah-beyaz', name: 'Siyah & Beyaz (demo)', description: 'Örnek koleksiyon — pasif, sitede görünmez.', isActive: false, sortOrder: 9, products: { create: [{ productId: bySlug.lune.id }, { productId: bySlug.duo.id }] } },
  });
  await prisma.contactMessage.create({
    data: { name: 'Elif Yılmaz (demo)', email: elif.email, phone: elifAddress.phone, subject: 'Ölçü bilgisi', message: 'Merhaba, Origami’nin ölçülerini paylaşabilir misiniz? Laptop sığar mı? (demo mesaj)' },
  });
  await prisma.newsletterSubscriber.create({ data: { email: `bulten${DEMO_EMAIL}`, locale: 'tr', source: 'demo' } });
  const luneVariant = bySlug.lune.variants[0];
  await prisma.stockAlert.create({ data: { variantId: luneVariant.id, email: `john${DEMO_EMAIL}`, locale: 'en' } });
  await prisma.emailCampaign.create({
    data: {
      subject: '[DEMO] Yeni sezon: Origami artık siyahta',
      preheader: 'Örnek kampanya taslağı — gönderilmez',
      title: 'Origami siyah',
      body: '<p>Merhaba,</p><p>Bu bir <strong>örnek</strong> kampanya taslağıdır.</p>',
      ctaLabel: 'Keşfet',
      ctaUrl: '/products/origami',
      audience: CampaignAudience.ALL,
    },
  });

  console.log('✓ demo eklendi: 3 sipariş (teslim edildi + iade talebi, kargoda, havale bekliyor), 2 müşteri, pasif kupon DEMO10,');
  console.log('  taslak journal yazısı, pasif koleksiyon, iletişim mesajı, bülten abonesi, stok alarmı, taslak kampanya');
  console.log('  Kaldırmak için: npm run db:seed:demo -- --remove');
}

(process.argv.includes('--remove') ? remove() : add())
  .catch((e: Prisma.PrismaClientKnownRequestError | Error) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
