/**
 * One-off catalogue seed: the 8 launch bags with photos, in 11 languages. Run after `npm run db:seed`:
 *   npm run db:seed:catalog
 * Idempotent — a product whose slug already exists (even deleted in the admin) is left alone, so it never
 * overwrites prices, stock or copy edited in the admin. Photos come from prisma/seed-assets/catalog
 * (already cropped to 4:5 with EXIF/GPS removed) and are written to UPLOAD_DIR like admin uploads.
 */
import 'dotenv/config';
import { HomeSectionType, Prisma, PrismaClient, ProductStatus } from '@prisma/client';
import { mkdir, readFile, readdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { HOME_V2, PRODUCT_COMMON, PRODUCTS, split } from './seed-data';

const prisma = new PrismaClient();
const ASSETS = join(__dirname, 'seed-assets', 'catalog');
const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR ?? './uploads');
const PUBLIC_BASE = (process.env.UPLOAD_PUBLIC_URL ?? 'http://localhost:4000/uploads').replace(/\/$/, '');
const WIDTHS = [400, 800, 1600, 2400];
/** Standard widths below the source plus the source itself (capped), so a 600px photo keeps a 600px rendition. */
const renditionWidths = (source: number) => [...new Set([...WIDTHS.filter((w) => w < source), Math.min(source, WIDTHS[WIDTHS.length - 1])])];

/** Writes renditions like MediaService.upload does and registers the file in the media library. */
async function importImage(folder: string, file: string, alt: string) {
  const src = await readFile(join(ASSETS, folder, file));
  const name = file.replace(/\.webp$/, '');
  const meta = await sharp(src).metadata();
  const renditions: Record<string, string> = {};
  let largestKey = '';
  for (const width of renditionWidths(meta.width!)) {
    const key = `catalog/${folder}/${name}-${width}.webp`;
    await mkdir(join(UPLOAD_DIR, 'catalog', folder), { recursive: true });
    await writeFile(join(UPLOAD_DIR, key), await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer());
    renditions[String(width)] = `${PUBLIC_BASE}/${key}`;
    largestKey = key;
  }
  const url = `${PUBLIC_BASE}/${largestKey}`;
  await prisma.media.upsert({
    where: { key: largestKey },
    create: { url, key: largestKey, mimeType: 'image/webp', size: src.length, width: meta.width, height: meta.height, alt, renditions },
    update: {},
  });
  return { url, width: meta.width!, height: meta.height! };
}

async function main() {
  const colors = Object.fromEntries((await prisma.color.findMany()).map((c) => [c.slug, c]));
  const bags = await prisma.category.findUnique({ where: { slug: 'bags' } });
  const signature = await prisma.collection.findUnique({ where: { slug: 'signature' } });
  if (!bags || !signature || !colors.ivory) throw new Error('Önce `npm run db:seed` çalıştırın (renkler/kategori eksik)');

  const common = split(PRODUCT_COMMON);
  for (const [i, p] of PRODUCTS.entries()) {
    if (await prisma.product.findUnique({ where: { slug: p.slug } })) {
      console.log(`– ${p.name}: zaten var, atlandı`);
      continue;
    }
    const copy = split({ subtitle: p.subtitle, description: p.description });
    const translations: Record<string, Record<string, string>> = {};
    for (const t of [common.translations, copy.translations]) {
      for (const [lang, fields] of Object.entries(t)) Object.assign((translations[lang] ??= {}), fields);
    }

    const files = (await readdir(join(ASSETS, p.slug))).filter((f) => f.endsWith('.webp')).sort();
    const images: Prisma.ProductImageCreateWithoutProductInput[] = [];
    for (const [n, file] of files.entries()) {
      const colorSlug = file.replace(/^\d+-|\.webp$/g, '');
      const color = colors[colorSlug];
      const img = await importImage(p.slug, file, `${p.name} — ${color?.name ?? ''}`.trim());
      images.push({ url: img.url, width: img.width, height: img.height, alt: `${p.name} — ${color?.name ?? ''}`, sortOrder: n, ...(color ? { color: { connect: { id: color.id } } } : {}) });
    }

    await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        ...copy.base,
        ...common.base,
        status: ProductStatus.ACTIVE,
        isFeatured: p.featured,
        basePrice: p.price,
        taxRate: 20,
        sortOrder: i,
        tags: ['bag', 'leather', 'canta', p.slug],
        publishedAt: new Date(),
        translations,
        category: { connect: { id: bags.id } },
        variants: { create: p.variants.map((v, k) => ({ sku: v.sku, stock: v.stock, sortOrder: k, color: { connect: { id: colors[v.color].id } } })) },
        images: { create: images },
        collections: { create: [{ collectionId: signature.id }] },
      },
    });
    console.log(`✓ ${p.name}: ${p.variants.length} renk, ${images.length} görsel, ${p.price} TL (fiyat/stok geçici — admin'den güncelleyin)`);
  }

  // The first seed's placeholder bag (no photos) is replaced by the real catalogue.
  const placeholder = await prisma.product.findUnique({ where: { slug: 'maeyja-signature-bag' }, include: { _count: { select: { images: true } } } });
  if (placeholder && !placeholder.deletedAt && placeholder.name === 'Signature Bag' && placeholder._count.images === 0) {
    await prisma.product.update({ where: { id: placeholder.id }, data: { status: ProductStatus.ARCHIVED, deletedAt: new Date(), isFeatured: false } });
    console.log('✓ eski yer tutucu "Signature Bag" arşivlendi');
  }

  // Homepage photos, only where the admin hasn't set one.
  const hero = await prisma.homeSection.findFirst({ where: { type: HomeSectionType.HERO }, orderBy: { sortOrder: 'asc' } });
  if (hero && !hero.imageUrl) {
    const wide = await importImage('_home', '01-hero.webp', 'MAEYJA');
    const tall = await importImage('_home', '03-editorial.webp', 'MAEYJA');
    await prisma.homeSection.update({ where: { id: hero.id }, data: { imageUrl: wide.url, mobileImageUrl: hero.mobileImageUrl ?? tall.url } });
    console.log('✓ ana sayfa görseli eklendi');
  }
  await prisma.homeSection.updateMany({ where: { type: HomeSectionType.HERO, ctaUrl: '/products/maeyja-signature-bag' }, data: { ctaUrl: '/products' } });
  const craft = await prisma.homeSection.findFirst({ where: { type: HomeSectionType.CRAFT_STORY } });
  if (craft && !craft.imageUrl) {
    const img = await importImage('_home', '02-craft.webp', 'MAEYJA atölye');
    await prisma.homeSection.update({ where: { id: craft.id }, data: { imageUrl: img.url } });
  }

  // Faz 1 homepage (once — skipped as soon as any section has a layout): a diptych, the model strip and a
  // full-width banner slot in between the existing blocks. Photos are stand-ins until the campaign shoot.
  if (!(await prisma.homeSection.count({ where: { layout: { not: null } } }))) {
    const order: Partial<Record<HomeSectionType, number>> = { HERO: 0, FEATURED_PRODUCTS: 1, CRAFT_STORY: 4, PRESS: 6, STOCKISTS: 7, NEWSLETTER: 8 };
    for (const [type, sortOrder] of Object.entries(order)) {
      const layout = type === 'FEATURED_PRODUCTS' ? 'grid' : type === 'CRAFT_STORY' ? 'split' : undefined;
      await prisma.homeSection.updateMany({ where: { type: type as HomeSectionType }, data: { sortOrder, ...(layout ? { layout } : {}) } });
    }
    const left = await importImage('origami', '06-red.webp', 'Origami');
    const right = await importImage('valise', '06-ivory.webp', 'Valise');
    const banner = await importImage('drape', '06-green.webp', 'Drape');
    const diptych = split(HOME_V2.DIPTYCH);
    const strip = split(HOME_V2.STRIP);
    const bannerCopy = split(HOME_V2.BANNER);
    const drape = await prisma.product.findUnique({ where: { slug: 'drape' } });
    await prisma.homeSection.createMany({
      data: [
        { type: HomeSectionType.EDITORIAL, layout: 'diptych', sortOrder: 2, imageUrl: left.url, secondImageUrl: right.url, ctaUrl: '/products', ...diptych.base, translations: diptych.translations },
        { type: HomeSectionType.FEATURED_PRODUCTS, layout: 'strip', sortOrder: 3, payload: {}, ...strip.base, translations: strip.translations },
        { type: HomeSectionType.EDITORIAL, layout: 'full', sortOrder: 5, imageUrl: banner.url, ctaUrl: '/products/drape', payload: drape ? { productIds: [drape.id] } : {}, ...bannerCopy.base, translations: bannerCopy.translations },
      ],
    });
    console.log('✓ ana sayfa: yan yana fotoğraflar, model şeridi ve banner eklendi');
  }

  console.log('✓ katalog tamam');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
