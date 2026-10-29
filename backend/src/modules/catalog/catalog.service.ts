import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { paginate } from '../../common/dto/pagination.dto';
import { Locale, localize } from '../../common/utils/i18n.util';
import { toNumber } from '../../common/utils/money.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductQueryDto, StockAlertDto } from './dto/catalog.dto';

const LOW_STOCK = 3;

/** Products a shopper may see. */
export const VISIBLE_PRODUCT: Prisma.ProductWhereInput = { status: ProductStatus.ACTIVE, deletedAt: null };
const LIVE_VARIANT: Prisma.ProductVariantWhereInput = { isActive: true, deletedAt: null };

/** What a product card needs; shared with the wishlist. */
export const cardInclude = {
  images: { orderBy: { sortOrder: 'asc' }, take: 6, include: { color: true } },
  variants: { where: LIVE_VARIANT, include: { color: true }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProductInclude;

type CardSource = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export const effectivePrice = (variant: { price: Prisma.Decimal | null }, product: { basePrice: Prisma.Decimal }) =>
  toNumber(variant.price ?? product.basePrice);

const PRODUCT_ORDER: Prisma.ProductOrderByWithRelationInput[] = [{ sortOrder: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }];

@Injectable()
export class CatalogService {
  private numbers: { at: number; byId: Map<string, number> } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Model number (N°01, N°02…) = position in the admin's product order among products a shopper can see. */
  async modelNumbers() {
    if (this.numbers && Date.now() - this.numbers.at < 60_000) return this.numbers.byId;
    const rows = await this.prisma.product.findMany({ where: VISIBLE_PRODUCT, select: { id: true }, orderBy: PRODUCT_ORDER });
    this.numbers = { at: Date.now(), byId: new Map(rows.map((r, i) => [r.id, i + 1])) };
    return this.numbers.byId;
  }

  async categories(lang: Locale) {
    const rows = await this.prisma.category.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    const items = rows.map((c) => localize(c, lang));
    // Return as a tree; the catalog is small enough to assemble in memory.
    const byParent = new Map<string | null, typeof items>();
    for (const c of items) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
    const build = (parentId: string | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((c) => ({ ...c, children: build(c.id) }));
    return build(null);
  }

  async collections(lang: Locale) {
    const rows = await this.prisma.collection.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
    return rows.map((c) => localize(c, lang));
  }

  async collection(slug: string, lang: Locale) {
    const row = await this.prisma.collection.findFirst({ where: { slug, isActive: true } });
    if (!row) throw new NotFoundException('Koleksiyon bulunamadı');
    const products = await this.products({ collection: slug, page: 1, limit: 100 } as ProductQueryDto, lang);
    return { ...localize(row, lang), products: products.items };
  }

  async colors(lang: Locale) {
    const rows = await this.prisma.color.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    return rows.map((c) => localize(c, lang));
  }

  /**
   * Storefront listing. A boutique catalogue is small (hundreds, not millions), so price filter/sort
   * — which depends on the cheapest live variant — is done in memory after the relational filters.
   */
  async products(q: ProductQueryDto, lang: Locale) {
    const colors = q.color?.split(',').filter(Boolean);
    const sizes = q.size?.split(',').filter(Boolean);
    const variantFilter: Prisma.ProductVariantWhereInput = {
      ...LIVE_VARIANT,
      ...(colors?.length ? { color: { slug: { in: colors } } } : {}),
      ...(sizes?.length ? { size: { in: sizes } } : {}),
    };
    const where: Prisma.ProductWhereInput = {
      ...VISIBLE_PRODUCT,
      variants: { some: variantFilter },
      ...(q.category ? { category: { OR: [{ slug: q.category }, { parent: { slug: q.category } }] } } : {}),
      ...(q.collection ? { collections: { some: { collection: { slug: q.collection, isActive: true } } } } : {}),
      ...(q.featured !== undefined ? { isFeatured: q.featured } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' } },
              { subtitle: { contains: q.q, mode: 'insensitive' } },
              { tags: { has: q.q.toLowerCase() } },
            ],
          }
        : {}),
    };

    const [rows, numbers] = await Promise.all([this.prisma.product.findMany({ where, include: cardInclude, orderBy: PRODUCT_ORDER }), this.modelNumbers()]);

    let cards = rows.map((p) => this.toCard(p, lang, numbers));
    if (q.minPrice !== undefined) cards = cards.filter((c) => c.price >= q.minPrice!);
    if (q.maxPrice !== undefined) cards = cards.filter((c) => c.price <= q.maxPrice!);
    if (q.sort === 'price_asc') cards.sort((a, b) => a.price - b.price);
    if (q.sort === 'price_desc') cards.sort((a, b) => b.price - a.price);
    if (q.sort === 'newest') cards.sort((a, b) => +new Date(b.publishedAt ?? 0) - +new Date(a.publishedAt ?? 0));
    if (q.sort === 'featured') cards.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));

    const start = (q.page - 1) * q.limit;
    return {
      ...paginate(cards.slice(start, start + q.limit), cards.length, q.page, q.limit),
      facets: this.facets(rows, lang),
    };
  }

  async product(slug: string, lang: Locale) {
    const p = await this.prisma.product.findFirst({
      where: { slug, ...VISIBLE_PRODUCT },
      include: {
        category: true,
        collections: { include: { collection: true } },
        images: { orderBy: { sortOrder: 'asc' }, include: { color: true } },
        variants: { where: LIVE_VARIANT, include: { color: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!p) throw new NotFoundException('Ürün bulunamadı');

    const { collections, category, images, variants, ...rest } = p;
    const localized = localize(rest, lang);
    const variantViews = variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color ? localize(v.color, lang) : null,
      price: effectivePrice(v, p),
      compareAtPrice: v.compareAtPrice ? toNumber(v.compareAtPrice) : p.compareAtPrice ? toNumber(p.compareAtPrice) : null,
      inStock: v.stock > 0,
      lowStock: v.stock > 0 && v.stock <= LOW_STOCK,
    }));
    const prices = variantViews.map((v) => v.price);

    const numbers = await this.modelNumbers();
    const related = await this.prisma.product.findMany({
      where: { ...VISIBLE_PRODUCT, id: { not: p.id }, ...(p.categoryId ? { categoryId: p.categoryId } : {}), variants: { some: LIVE_VARIANT } },
      include: cardInclude,
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
      take: 4,
    });

    return {
      ...localized,
      number: numbers.get(p.id) ?? null,
      basePrice: toNumber(p.basePrice),
      compareAtPrice: p.compareAtPrice ? toNumber(p.compareAtPrice) : null,
      priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
      category: category ? localize(category, lang) : null,
      collections: collections.map((c) => localize(c.collection, lang)),
      images: images.map(({ color, ...img }) => ({ ...img, alt: this.imageAlt(localized.name, color, lang), colorSlug: color?.slug ?? null })),
      variants: variantViews,
      colors: this.uniqueColors(variants, lang),
      sizes: [...new Set(variants.map((v) => v.size).filter((s): s is string => Boolean(s)))],
      inStock: variantViews.some((v) => v.inStock),
      related: related.map((r) => this.toCard(r, lang, numbers)),
    };
  }

  async createStockAlert(dto: StockAlertDto) {
    const variant = await this.prisma.productVariant.findFirst({ where: { id: dto.variantId, ...LIVE_VARIANT } });
    if (!variant) throw new NotFoundException('Ürün bulunamadı');
    if (variant.stock > 0) throw new BadRequestException('Bu ürün zaten stokta');
    await this.prisma.stockAlert.upsert({
      where: { variantId_email: { variantId: dto.variantId, email: dto.email } },
      create: { variantId: dto.variantId, email: dto.email, locale: dto.locale ?? 'tr' },
      update: { notifiedAt: null, locale: dto.locale ?? 'tr' },
    });
    return { ok: true };
  }

  // ─────────────────────────── shaping ───────────────────────────

  toCard(p: CardSource, lang: Locale, numbers?: Map<string, number>) {
    const prices = p.variants.map((v) => effectivePrice(v, p));
    const price = prices.length ? Math.min(...prices) : toNumber(p.basePrice);
    const { name, subtitle } = localize({ name: p.name, subtitle: p.subtitle, translations: p.translations }, lang);
    return {
      id: p.id,
      slug: p.slug,
      number: numbers?.get(p.id) ?? null,
      name,
      subtitle,
      price,
      compareAtPrice: p.compareAtPrice ? toNumber(p.compareAtPrice) : null,
      hasPriceRange: new Set(prices).size > 1,
      isFeatured: p.isFeatured,
      publishedAt: p.publishedAt,
      // First two images drive the hover swap on the listing grid.
      images: p.images.slice(0, 2).map((i) => ({ url: i.url, alt: this.imageAlt(name, i.color, lang), width: i.width, height: i.height })),
      colors: this.uniqueColors(p.variants, lang),
      inStock: p.variants.some((v) => v.stock > 0),
    };
  }

  /** Alt text in the reader's language ("Origami — Red"); stored alts are Turkish. */
  private imageAlt(name: string, color: { name: string; translations: Prisma.JsonValue } | null, lang: Locale) {
    return color ? `${name} — ${localize({ name: color.name, translations: color.translations }, lang).name}` : name;
  }

  private uniqueColors(variants: CardSource['variants'], lang: Locale) {
    const seen = new Map<string, { slug: string; name: string; hex: string; hex2: string | null; inStock: boolean }>();
    for (const v of variants) {
      if (!v.color) continue;
      const prev = seen.get(v.color.id);
      const { name } = localize({ name: v.color.name, translations: v.color.translations }, lang);
      seen.set(v.color.id, {
        slug: v.color.slug,
        name,
        hex: v.color.hex,
        hex2: v.color.hex2,
        inStock: (prev?.inStock ?? false) || v.stock > 0,
      });
    }
    return [...seen.values()];
  }

  private facets(rows: CardSource[], lang: Locale) {
    const colors = new Map<string, { slug: string; name: string; hex: string; hex2: string | null; count: number }>();
    const sizes = new Map<string, number>();
    const prices: number[] = [];
    for (const p of rows) {
      const seenColors = new Set<string>();
      for (const v of p.variants) {
        prices.push(effectivePrice(v, p));
        if (v.size) sizes.set(v.size, (sizes.get(v.size) ?? 0) + 1);
        if (v.color && !seenColors.has(v.color.id)) {
          seenColors.add(v.color.id);
          const { name } = localize({ name: v.color.name, translations: v.color.translations }, lang);
          const prev = colors.get(v.color.id);
          colors.set(v.color.id, { slug: v.color.slug, name, hex: v.color.hex, hex2: v.color.hex2, count: (prev?.count ?? 0) + 1 });
        }
      }
    }
    return {
      colors: [...colors.values()],
      sizes: [...sizes.entries()].map(([size, count]) => ({ size, count })),
      price: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    };
  }
}
