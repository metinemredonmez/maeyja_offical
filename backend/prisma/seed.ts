/* Idempotent seed: safe to run on every deploy. Run with `npm run db:seed`. Products: `npm run db:seed:catalog`. */
import 'dotenv/config';
import { HomeSectionType, Prisma, PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PAGE_BODIES } from './seed-pages';
import { ABOUT_BODY, CATEGORIES, COLORS, FAQS, HOME, PAGES, SIGNATURE_COLLECTION, split, type Translations } from './seed-data';

const prisma = new PrismaClient();

/**
 * Adds languages/fields that are missing from a `translations` column. Anything already there — e.g. text
 * an admin edited — is kept, so this can run on every deploy. Returns null when nothing changed.
 */
export function fillTranslations(current: unknown, seeded: Translations): Translations | null {
  const out: Translations = JSON.parse(JSON.stringify(current && typeof current === 'object' ? current : {}));
  let changed = false;
  for (const [lang, fields] of Object.entries(seeded)) {
    for (const [key, value] of Object.entries(fields)) {
      if (!out[lang]?.[key]) {
        (out[lang] ??= {})[key] = value;
        changed = true;
      }
    }
  }
  return changed ? out : null;
}

const json = (t: Translations) => t as Prisma.InputJsonValue;

/** Homepage texts from the very first seed that are replaced by the current copy (unless an admin changed them). */
const LEGACY_HOME: Record<string, Record<string, string>> = { FEATURED_PRODUCTS: { title: 'Signature' } };

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
    const { base, translations } = split({ name: c.name });
    const row = await prisma.color.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: base.name, hex: c.hex, hex2: c.hex2, sortOrder: i, translations: json(translations) },
      update: {},
    });
    const merged = fillTranslations(row.translations, translations);
    if (merged) await prisma.color.update({ where: { id: row.id }, data: { translations: json(merged) } });
  }
  // First-seed swatches that don't match the real leather; only fixed if nobody edited them.
  await prisma.color.updateMany({ where: { slug: 'bicolor', hex2: '#A3121B' }, data: { hex2: '#E9E2D6' } });
  await prisma.color.updateMany({ where: { slug: 'green', hex: '#2F4A36' }, data: { hex: '#1F3B3A' } });

  // ── Taxonomy
  for (const c of CATEGORIES) {
    const { base, translations } = split({ name: c.name });
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: base.name, sortOrder: c.sortOrder, isActive: c.isActive, translations: json(translations) },
      update: {},
    });
    const merged = fillTranslations(row.translations, translations);
    if (merged) await prisma.category.update({ where: { id: row.id }, data: { translations: json(merged) } });
  }
  {
    const { base, translations } = split(SIGNATURE_COLLECTION);
    const row = await prisma.collection.upsert({
      where: { slug: 'signature' },
      create: { slug: 'signature', name: 'Signature', description: base.description, translations: json(translations) },
      update: {},
    });
    const merged = fillTranslations(row.translations, translations);
    if (merged) await prisma.collection.update({ where: { id: row.id }, data: { translations: json(merged) } });
  }

  // ── Settings
  await prisma.setting.upsert({
    where: { key: 'shipping' },
    create: { key: 'shipping', value: { flatRate: 0, freeShippingThreshold: 0, estimatedDays: '1-3' } },
    update: {},
  });

  // ── Pages (bodies are written in the admin)
  for (const p of PAGES) {
    const { base, translations } = split({ title: p.title });
    const row = await prisma.page.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, title: base.title, body: `<p>${base.title} metni buraya gelecek.</p>`, translations: json(translations) },
      update: {},
    });
    const merged = fillTranslations(row.translations, translations);
    if (merged) await prisma.page.update({ where: { id: row.id }, data: { translations: json(merged) } });
  }
  // Store and legal pages: replace the original placeholders only (text written in the admin stays).
  for (const [slug, body] of Object.entries(PAGE_BODIES)) {
    const updated = await prisma.page.updateMany({ where: { slug, body: { contains: 'metni buraya gelecek' } }, data: { body } });
    if (updated.count) console.log(`✓ sayfa metni eklendi: ${slug}`);
  }
  // About: replace the original placeholder only (text written in the admin stays).
  const about = await prisma.page.findUnique({ where: { slug: 'about' } });
  if (about && /metni buraya gelecek/.test(about.body)) {
    const t = (about.translations ?? {}) as Translations;
    await prisma.page.update({ where: { id: about.id }, data: { body: ABOUT_BODY.tr, translations: json({ ...t, en: { ...t.en, body: ABOUT_BODY.en } }) } });
    console.log('✓ hakkımızda metni eklendi');
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

  // ── FAQ (existing rows are matched by their Turkish question)
  for (const f of FAQS) {
    const { base, translations } = split({ group: f.group, question: f.question, answer: f.answer });
    const row =
      (await prisma.faq.findFirst({ where: { question: base.question } })) ??
      (await prisma.faq.create({ data: { ...base, sortOrder: f.sortOrder, translations: json(translations) } }));
    const merged = fillTranslations(row.translations, translations);
    if (merged) await prisma.faq.update({ where: { id: row.id }, data: { translations: json(merged) } });
  }

  // ── Homepage
  if (!(await prisma.homeSection.count())) {
    await prisma.homeSection.createMany({
      data: [
        { type: HomeSectionType.HERO, title: 'Hand crafted elegance.', ctaUrl: '/products', sortOrder: 0 },
        { type: HomeSectionType.FEATURED_PRODUCTS, sortOrder: 1, payload: { limit: 4 } },
        { type: HomeSectionType.CRAFT_STORY, ctaUrl: '/about', sortOrder: 2 },
        { type: HomeSectionType.PRESS, sortOrder: 3 },
        { type: HomeSectionType.STOCKISTS, sortOrder: 4 },
        { type: HomeSectionType.NEWSLETTER, sortOrder: 5 },
      ],
    });
  }
  // Fill empty base text and missing languages per section type; text edited in the admin is left alone.
  for (const s of await prisma.homeSection.findMany()) {
    const copy = HOME[s.type];
    if (!copy) continue;
    const { base, translations } = split(copy);
    const emptyBase = Object.fromEntries(
      Object.entries(base).filter(([k]) => !s[k as keyof typeof s] || LEGACY_HOME[s.type]?.[k] === s[k as keyof typeof s]),
    );
    const merged = fillTranslations(s.translations, translations);
    if (merged || Object.keys(emptyBase).length) {
      await prisma.homeSection.update({ where: { id: s.id }, data: { ...emptyBase, ...(merged ? { translations: json(merged) } : {}) } });
    }
  }

  console.log('✓ seed complete');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
