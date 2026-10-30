/**
 * One-off catalogue seed: the 8 launch bags with photos, in 11 languages. Run after `npm run db:seed`:
 *   npm run db:seed:catalog
 * Idempotent — a product whose slug already exists (even deleted in the admin) is left alone, so it never
 * overwrites prices, stock or copy edited in the admin. Photos come from prisma/seed-assets/catalog
 * (already cropped to 4:5 with EXIF/GPS removed) and are written to UPLOAD_DIR like admin uploads.
 */
import 'dotenv/config';
import { HomeSectionType, Prisma, PrismaClient, ProductStatus } from '@prisma/client';
import { access, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { HOME_V2, PRODUCT_COMMON, PRODUCTS, split } from './seed-data';
import { JOURNAL_POSTS } from './seed-pages';

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

/** Copies a campaign video next to the uploads and registers it; null when the file is not in the seed assets. */
async function importVideo(folder: string, file: string, alt: string) {
  const src = join(ASSETS, folder, file);
  if (!(await access(src).then(() => true, () => false))) return null;
  const key = `catalog/${folder}/${file}`;
  await mkdir(join(UPLOAD_DIR, 'catalog', folder), { recursive: true });
  await copyFile(src, join(UPLOAD_DIR, key));
  const url = `${PUBLIC_BASE}/${key}`;
  await prisma.media.upsert({ where: { key }, create: { url, key, mimeType: 'video/mp4', size: (await stat(src)).size, alt }, update: {} });
  return url;
}

const isSeeded = (url: string | null, file: string) => !url || url.includes(`/catalog/${file}`);

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
    const left = await importImage('_home', '14-still-origami.webp', 'Origami');
    const right = await importImage('_home', '15-still-valise.webp', 'Valise');
    const pair = await prisma.product.findMany({ where: { slug: { in: ['origami', 'valise'] } }, select: { id: true, slug: true } });
    const pairIds = ['origami', 'valise'].flatMap((slug) => pair.filter((p) => p.slug === slug).map((p) => p.id));
    const banner = await importImage('_home', '12-campaign-drape-close.webp', 'Drape');
    const diptych = split(HOME_V2.DIPTYCH);
    const strip = split(HOME_V2.STRIP);
    const bannerCopy = split(HOME_V2.BANNER);
    const drape = await prisma.product.findUnique({ where: { slug: 'drape' } });
    await prisma.homeSection.createMany({
      data: [
        { type: HomeSectionType.EDITORIAL, layout: 'diptych', sortOrder: 2, imageUrl: left.url, secondImageUrl: right.url, ctaUrl: '/products', payload: { productIds: pairIds }, ...diptych.base, translations: diptych.translations },
        { type: HomeSectionType.FEATURED_PRODUCTS, layout: 'strip', sortOrder: 3, payload: {}, ...strip.base, translations: strip.translations },
        { type: HomeSectionType.EDITORIAL, layout: 'full', sortOrder: 5, imageUrl: banner.url, ctaUrl: '/products/drape', payload: drape ? { productIds: [drape.id] } : {}, ...bannerCopy.base, translations: bannerCopy.translations },
      ],
    });
    console.log('✓ ana sayfa: yan yana fotoğraflar, model şeridi ve banner eklendi');
  }

  // Campaign photos/films (model shots): replace the seeded stand-ins only — anything picked in the admin stays.
  const heroNow = await prisma.homeSection.findFirst({ where: { type: HomeSectionType.HERO }, orderBy: { sortOrder: 'asc' } });
  // The hero went table photo → Rome (film) → Iceland's black-sand coast. The first black-sand set put the Origami on a long
  // shoulder strap it doesn't have (it has two short handles), so it is replaced too. Only what the seed itself put there changes.
  const seededHero = ['_home/01-hero', '_home/10-campaign-rome', '_home/10-campaign-blacksand'];
  if (heroNow && seededHero.some((file) => isSeeded(heroNow.imageUrl, file))) {
    const wide = await importImage('_home', '10-campaign-iceland-coast.webp', 'Origami');
    const tall = await importImage('_home', '11-campaign-iceland-coast-mobile.webp', 'Origami');
    const film = await importVideo('_home', 'hero-iceland-coast.mp4', 'Origami');
    const seededFilm = !heroNow.videoUrl || /\/catalog\/_home\/hero-(rome|blacksand)/.test(heroNow.videoUrl);
    await prisma.homeSection.update({ where: { id: heroNow.id }, data: { imageUrl: wide.url, mobileImageUrl: tall.url, ...(seededFilm ? { videoUrl: film } : {}) } });
    console.log('✓ hero: İzlanda siyah kum sahili, kısa kulplu Origami' + (film ? ' + video' : ''));
  }
  // The banner's earlier stand-ins (Drape table photo, then a Rome film whose bag wasn't true to the Drape) give way
  // to a close shot where the bag matches the product. Only seeded media is replaced.
  const oldBanner = await prisma.homeSection.findFirst({
    where: { type: HomeSectionType.EDITORIAL, layout: 'full', OR: [{ imageUrl: { contains: '/catalog/drape/06-green' } }, { imageUrl: { contains: '/catalog/_home/12-campaign-rome-steps' } }] },
  });
  if (oldBanner) {
    const banner = await importImage('_home', '12-campaign-drape-close.webp', 'Drape');
    const seededFilm = !oldBanner.videoUrl || oldBanner.videoUrl.includes('/catalog/_home/band-rome-steps');
    await prisma.homeSection.update({ where: { id: oldBanner.id }, data: { imageUrl: banner.url, ...(seededFilm ? { videoUrl: null } : {}) } });
    console.log('✓ banner: Drape yakın çekim');
  }
  // Copy over the sideways model (only while it has none).
  const sidewaysCopy = split(HOME_V2.SIDEWAYS);
  await prisma.homeSection.updateMany({ where: { layout: 'sideways', title: null }, data: { ...sidewaysCopy.base, ctaUrl: '/products', translations: sidewaysCopy.translations } });
  // Manu-style sideways model band, right after the model strip (once).
  if (!(await prisma.homeSection.count({ where: { layout: 'sideways' } }))) {
    const strip = await prisma.homeSection.findFirst({ where: { layout: 'strip' } });
    const at = (strip?.sortOrder ?? 3) + 1;
    await prisma.homeSection.updateMany({ where: { sortOrder: { gte: at } }, data: { sortOrder: { increment: 1 } } });
    const studio = await importImage('_home', '20-campaign-studio.webp', 'Origami — stüdyo');
    await prisma.homeSection.create({ data: { type: HomeSectionType.EDITORIAL, layout: 'sideways', sortOrder: at, imageUrl: studio.url, ctaUrl: '/products', ...sidewaysCopy.base, translations: sidewaysCopy.translations } });
    console.log('✓ ana sayfa: yan yatık manken bandı');
  }

  // The diptych's first pictures were the plain table shots of the Origami and the Valise; they give way to
  // still-lifes on travertine, captioned with both bags. Pictures or products picked in the admin stay.
  const diptychNow = await prisma.homeSection.findFirst({ where: { layout: 'diptych' } });
  if (diptychNow && isSeeded(diptychNow.imageUrl, 'origami/06-red') && isSeeded(diptychNow.secondImageUrl, 'valise/06-ivory')) {
    const left = await importImage('_home', '14-still-origami.webp', 'Origami');
    const right = await importImage('_home', '15-still-valise.webp', 'Valise');
    const pair = await prisma.product.findMany({ where: { slug: { in: ['origami', 'valise'] } }, select: { id: true, slug: true } });
    const ids = ['origami', 'valise'].flatMap((slug) => pair.filter((p) => p.slug === slug).map((p) => p.id));
    const payload = (diptychNow.payload ?? {}) as { productIds?: string[] };
    await prisma.homeSection.update({
      where: { id: diptychNow.id },
      data: { imageUrl: left.url, secondImageUrl: right.url, ...(payload.productIds?.length ? {} : { payload: { ...payload, productIds: ids } }) },
    });
    console.log('✓ ana sayfa: yan yana natürmortlar');
  }
  // The sideways model and the Drape band move up, right after the collection, ahead of the diptych — only while
  // the page is still in the order the seed built (any reordering in the admin is left alone).
  const built = ['HERO', 'grid', 'diptych', 'strip', 'sideways', 'split', 'full', 'PRESS', 'STOCKISTS', 'NEWSLETTER'];
  const wanted = ['HERO', 'grid', 'sideways', 'full', 'diptych', 'strip', 'split', 'PRESS', 'STOCKISTS', 'NEWSLETTER'];
  const sections = await prisma.homeSection.findMany({ orderBy: { sortOrder: 'asc' } });
  const keys = sections.map((sec) => sec.layout ?? sec.type);
  if (keys.join() === built.join()) {
    await prisma.$transaction(sections.map((sec, i) => prisma.homeSection.update({ where: { id: sec.id }, data: { sortOrder: wanted.indexOf(keys[i]) } })));
    console.log('✓ ana sayfa: manken ve Drape bandı yukarı');
  }

  // "On display": the shelf wall with all eight bags and the Lune on a walnut counter, once, just before the press quotes.
  if (!(await prisma.homeSection.count({ where: { layout: 'boutique' } }))) {
    const press = await prisma.homeSection.findFirst({ where: { type: HomeSectionType.PRESS } });
    const at = press?.sortOrder ?? (await prisma.homeSection.count());
    await prisma.homeSection.updateMany({ where: { sortOrder: { gte: at } }, data: { sortOrder: { increment: 1 } } });
    const wall = await importImage('_home', '18-boutique-wall.webp', 'MAEYJA');
    const counter = await importImage('_home', '17-boutique-lune.webp', 'Lune');
    const lune = await prisma.product.findUnique({ where: { slug: 'lune' }, select: { id: true } });
    const copy = split(HOME_V2.BOUTIQUE);
    await prisma.homeSection.create({
      data: { type: HomeSectionType.EDITORIAL, layout: 'boutique', sortOrder: at, imageUrl: wall.url, secondImageUrl: counter.url, ctaUrl: '/products', payload: lune ? { productIds: [lune.id] } : {}, ...copy.base, translations: copy.translations },
    });
    console.log('✓ ana sayfa: vitrin bölümü');
  }
  // The first shelf wall stood the Drape's and the Duo's straps on the shelf; the second has them arching as they do.
  const firstWall = await prisma.homeSection.findFirst({ where: { layout: 'boutique', imageUrl: { contains: '/catalog/_home/16-boutique-wall' } } });
  if (firstWall) {
    const wall = await importImage('_home', '18-boutique-wall.webp', 'MAEYJA');
    await prisma.homeSection.update({ where: { id: firstWall.id }, data: { imageUrl: wall.url } });
    console.log('✓ ana sayfa: vitrin fotoğrafı yenilendi');
  }
  // The first studio portraits gave the Origami a long strap, then wore it on the shoulder; now she carries it by
  // its short handles on her forearm. Earlier seeded versions (13, 19) are swapped wherever they are still used.
  const oldStudio = ['/catalog/_home/13-campaign-studio', '/catalog/_home/19-campaign-studio'];
  const sectionsWhere = { OR: oldStudio.map((f) => ({ imageUrl: { contains: f } })) };
  const postsWhere = { OR: oldStudio.map((f) => ({ coverImageUrl: { contains: f } })) };
  if ((await prisma.homeSection.count({ where: sectionsWhere })) || (await prisma.journalPost.count({ where: postsWhere }))) {
    const studio = await importImage('_home', '20-campaign-studio.webp', 'Origami — stüdyo');
    await prisma.homeSection.updateMany({ where: sectionsWhere, data: { imageUrl: studio.url } });
    await prisma.journalPost.updateMany({ where: postsWhere, data: { coverImageUrl: studio.url } });
    console.log('✓ stüdyo fotoğrafı: Origami kolda, kısa kulplarıyla');
  }
  // The sideways band gets two more models from the same studio shoot, fading in one after another on scroll —
  // only while it still shows the seeded portrait and has no photos of its own.
  const band = await prisma.homeSection.findFirst({ where: { layout: 'sideways', imageUrl: { contains: '/catalog/_home/20-campaign-studio' } } });
  const bandPayload = (band?.payload ?? {}) as { images?: string[] };
  if (band && !bandPayload.images?.length) {
    const ivory = await importImage('_home', '21-studio-ivory.webp', 'Origami — stüdyo');
    const black = await importImage('_home', '22-studio-black.webp', 'Origami — stüdyo');
    await prisma.homeSection.update({ where: { id: band.id }, data: { payload: { ...bandPayload, images: [ivory.url, black.url] } } });
    console.log('✓ yan yatık bant: üç manken, kaydırınca sırayla');
  }
  // Product photos re-shot in one studio: a white cut-out first, then the same terracotta set from several angles.
  // The first seeded set came from café tables, at mixed sizes, some with hang tags. Swapped once per bag, only
  // while it still has that first set; photos added in the admin stay, after the new ones.
  for (const entry of await readdir(ASSETS, { withFileTypes: true })) {
    const slug = entry.name;
    if (!entry.isDirectory() || slug.startsWith('_')) continue;
    const product = await prisma.product.findUnique({ where: { slug }, include: { images: { orderBy: { sortOrder: 'asc' } } } });
    if (!product?.images.some((i) => new RegExp(`/catalog/${slug}/0\\d-`).test(i.url))) continue;
    const files = (await readdir(join(ASSETS, slug))).filter((f) => f.endsWith('.webp')).sort();
    const seeded = product.images.filter((i) => i.url.includes('/catalog/'));
    const kept = product.images.filter((i) => !i.url.includes('/catalog/'));
    const fresh: Prisma.ProductImageCreateManyInput[] = [];
    for (const [n, file] of files.entries()) {
      const color = colors[file.replace(/^\d+-|\.webp$/g, '')];
      const alt = `${product.name} — ${color?.name ?? ''}`.trim();
      const img = await importImage(slug, file, alt);
      fresh.push({ productId: product.id, url: img.url, width: img.width, height: img.height, alt, sortOrder: n, colorId: color?.id ?? null });
    }
    await prisma.$transaction([
      prisma.productImage.deleteMany({ where: { id: { in: seeded.map((i) => i.id) } } }),
      prisma.productImage.createMany({ data: fresh }),
      ...kept.map((k, n) => prisma.productImage.update({ where: { id: k.id }, data: { sortOrder: fresh.length + n } })),
    ]);
    console.log(`✓ ${product.name}: yeni stüdyo fotoğrafları (${fresh.length})`);
  }
  // Each bag's second picture is a campaign or still-life photo: on the product page it opens the left column
  // (Polène) and on the listing it is the hover picture. Added once per bag, only while its first photo is the seeded one.
  const lifestyle = await readdir(join(ASSETS, '_lifestyle')).catch(() => [] as string[]);
  for (const file of lifestyle.filter((f) => f.endsWith('.webp'))) {
    const [slug, colorSlug] = file.replace(/\.webp$/, '').split('-');
    const product = await prisma.product.findUnique({ where: { slug }, include: { images: { orderBy: { sortOrder: 'asc' } } } });
    if (!product?.images[0]?.url.includes(`/catalog/${slug}/`) || product.images.some((i) => i.url.includes('/catalog/_lifestyle/'))) continue;
    const color = colors[colorSlug];
    const alt = `${product.name} — ${color?.name ?? ''}`.trim();
    const img = await importImage('_lifestyle', file, alt);
    await prisma.$transaction([
      prisma.productImage.updateMany({ where: { productId: product.id, sortOrder: { gte: 1 } }, data: { sortOrder: { increment: 1 } } }),
      prisma.productImage.create({ data: { productId: product.id, url: img.url, width: img.width, height: img.height, alt, sortOrder: 1, colorId: color?.id ?? null } }),
    ]);
    console.log(`✓ ${product.name}: kampanya fotoğrafı ikinci sırada`);
  }

  // First journal posts (created once per slug; edits and deletions in the admin are respected afterwards).
  for (const [i, post] of JOURNAL_POSTS.entries()) {
    if (await prisma.journalPost.findUnique({ where: { slug: post.slug } })) continue;
    const cover = await importImage(post.cover[0], post.cover[1], post.title);
    await prisma.journalPost.create({
      data: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        coverImageUrl: cover.url,
        status: 'PUBLISHED',
        // A day apart, newest first in the list.
        publishedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`✓ journal: ${post.title}`);
  }

  console.log('✓ katalog tamam');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
