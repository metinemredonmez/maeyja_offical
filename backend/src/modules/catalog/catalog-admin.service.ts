import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProductStatus } from '@prisma/client';
import { paginate, skipTake } from '../../common/dto/pagination.dto';
import { slugify } from '../../common/utils/slug.util';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { mailLocale, templates } from '../notifications/mail.templates';
import {
  AdminProductQueryDto,
  CategoryDto,
  CollectionDto,
  ColorDto,
  ImageDto,
  ProductDto,
  StockUpdateDto,
  UpdateCategoryDto,
  UpdateCollectionDto,
  UpdateColorDto,
  UpdateImageDto,
  UpdateProductDto,
  UpdateVariantDto,
  VariantDto,
} from './dto/catalog.dto';

const LOW_STOCK = 3;
const json = (v: unknown) => (v === undefined ? undefined : v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

@Injectable()
export class CatalogAdminService {
  private readonly logger = new Logger(CatalogAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ─────────────────────────── products ───────────────────────────

  async listProducts(q: AdminProductQueryDto) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.lowStock ? { variants: { some: { deletedAt: null, isActive: true, stock: { lte: LOW_STOCK } } } } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' } },
              { slug: { contains: q.q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: q.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        ...skipTake(q),
        include: {
          category: { select: { id: true, name: true } },
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          variants: { where: { deletedAt: null }, select: { id: true, stock: true, isActive: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    const items = rows.map(({ variants, images, ...p }) => ({
      ...p,
      thumbnail: images[0]?.url ?? null,
      variantCount: variants.length,
      totalStock: variants.reduce((s, v) => s + v.stock, 0),
      lowStock: variants.some((v) => v.isActive && v.stock <= LOW_STOCK),
    }));
    return paginate(items, total, q.page, q.limit);
  }

  async getProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        collections: { include: { collection: true }, orderBy: { sortOrder: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { where: { deletedAt: null }, include: { color: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı');
    const waiting = await this.prisma.stockAlert.groupBy({
      by: ['variantId'],
      where: { variantId: { in: product.variants.map((v) => v.id) }, notifiedAt: null },
      _count: true,
    });
    const waitingByVariant = new Map(waiting.map((w) => [w.variantId, w._count]));
    return {
      ...product,
      collectionIds: product.collections.map((c) => c.collectionId),
      variants: product.variants.map((v) => ({ ...v, stockAlertsWaiting: waitingByVariant.get(v.id) ?? 0 })),
    };
  }

  async createProduct(dto: ProductDto) {
    const { variants, images, collectionIds, translations, ...data } = dto;
    if (!variants?.length) throw new BadRequestException('En az bir varyant (renk/beden) gerekli');
    this.assertUniqueVariantCombos(variants);
    const slug = await this.uniqueSlug('product', dto.slug ?? slugify(dto.name));
    const product = await this.prisma.product.create({
      data: {
        ...data,
        slug,
        translations: json(translations),
        publishedAt: data.status === ProductStatus.ACTIVE ? new Date() : null,
        variants: { create: variants.map((v, i) => ({ ...v, sortOrder: v.sortOrder ?? i })) },
        images: images?.length ? { create: images.map((img, i) => ({ ...img, sortOrder: img.sortOrder ?? i })) } : undefined,
        collections: collectionIds?.length ? { create: collectionIds.map((collectionId) => ({ collectionId })) } : undefined,
      },
    });
    return this.getProduct(product.id);
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Ürün bulunamadı');
    // Variants and images have their own endpoints so stock is never overwritten by a stale form.
    const { variants: _v, images: _i, collectionIds, translations, ...data } = dto;
    const slug = dto.slug && dto.slug !== existing.slug ? await this.uniqueSlug('product', dto.slug, id) : undefined;
    const goingLive = data.status === ProductStatus.ACTIVE && existing.status !== ProductStatus.ACTIVE && !existing.publishedAt;

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { ...data, slug, translations: json(translations), ...(goingLive ? { publishedAt: new Date() } : {}) },
      });
      if (collectionIds) {
        await tx.productCollection.deleteMany({ where: { productId: id } });
        if (collectionIds.length) {
          await tx.productCollection.createMany({ data: collectionIds.map((collectionId, sortOrder) => ({ productId: id, collectionId, sortOrder })) });
        }
      }
    });
    return this.getProduct(id);
  }

  /** Soft delete: past orders keep pointing at it; the slug is freed for reuse. */
  async deleteProduct(id: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Ürün bulunamadı');
    const stamp = Date.now().toString(36);
    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id },
        data: { deletedAt: new Date(), status: ProductStatus.ARCHIVED, slug: `${existing.slug}-deleted-${stamp}` },
      }),
      this.prisma.productVariant.updateMany({ where: { productId: id }, data: { deletedAt: new Date(), isActive: false } }),
      this.prisma.cartItem.deleteMany({ where: { variant: { productId: id } } }),
    ]);
    return { ok: true };
  }

  async duplicateProduct(id: string) {
    const src = await this.getProduct(id);
    const slug = await this.uniqueSlug('product', `${src.slug}-kopya`);
    const stamp = Date.now().toString(36).toUpperCase();
    const copy = await this.prisma.product.create({
      data: {
        slug,
        name: `${src.name} (kopya)`,
        subtitle: src.subtitle,
        description: src.description,
        story: src.story,
        material: src.material,
        care: src.care,
        dimensions: src.dimensions,
        madeIn: src.madeIn,
        sizeGuide: src.sizeGuide,
        status: ProductStatus.DRAFT,
        basePrice: src.basePrice,
        compareAtPrice: src.compareAtPrice,
        taxRate: src.taxRate,
        categoryId: src.categoryId,
        tags: src.tags,
        translations: json(src.translations),
        variants: {
          create: src.variants.map((v) => ({
            sku: `${v.sku}-${stamp}`,
            colorId: v.colorId,
            size: v.size,
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            stock: 0,
            sortOrder: v.sortOrder,
          })),
        },
        images: { create: src.images.map((i) => ({ url: i.url, alt: i.alt, colorId: i.colorId, width: i.width, height: i.height, sortOrder: i.sortOrder })) },
      },
    });
    return this.getProduct(copy.id);
  }

  // ─────────────────────────── variants & stock ───────────────────────────

  async addVariant(productId: string, dto: VariantDto) {
    await this.ensureProduct(productId);
    await this.assertComboFree(productId, dto.colorId ?? null, dto.size ?? null);
    return this.prisma.productVariant.create({ data: { ...dto, productId } });
  }

  async updateVariant(id: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findFirst({ where: { id, deletedAt: null } });
    if (!variant) throw new NotFoundException('Varyant bulunamadı');
    if (dto.colorId !== undefined || dto.size !== undefined) {
      await this.assertComboFree(variant.productId, dto.colorId ?? variant.colorId, dto.size ?? variant.size, id);
    }
    const updated = await this.prisma.productVariant.update({ where: { id }, data: dto });
    if (variant.stock <= 0 && updated.stock > 0) void this.notifyRestock(id);
    return updated;
  }

  async deleteVariant(id: string) {
    const variant = await this.prisma.productVariant.findFirst({ where: { id, deletedAt: null } });
    if (!variant) throw new NotFoundException('Varyant bulunamadı');
    const remaining = await this.prisma.productVariant.count({ where: { productId: variant.productId, deletedAt: null } });
    if (remaining <= 1) throw new BadRequestException('Ürünün son varyantı silinemez — ürünü arşivleyin');
    await this.prisma.$transaction([
      this.prisma.productVariant.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, sku: `${variant.sku}-deleted-${Date.now().toString(36)}` } }),
      this.prisma.cartItem.deleteMany({ where: { variantId: id } }),
    ]);
    return { ok: true };
  }

  async updateStock(id: string, dto: StockUpdateDto) {
    if (dto.stock === undefined && dto.delta === undefined) throw new BadRequestException('stock veya delta gerekli');
    const variant = await this.prisma.productVariant.findFirst({ where: { id, deletedAt: null } });
    if (!variant) throw new NotFoundException('Varyant bulunamadı');
    const next = dto.stock ?? variant.stock + (dto.delta ?? 0);
    if (next < 0) throw new BadRequestException('Stok negatif olamaz');
    const updated = await this.prisma.productVariant.update({ where: { id }, data: { stock: next } });
    if (variant.stock <= 0 && next > 0) void this.notifyRestock(id);
    return updated;
  }

  /** Emails everyone waiting on this variant, once. */
  async notifyRestock(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: true, color: true } });
    if (!variant) return;
    const alerts = await this.prisma.stockAlert.findMany({ where: { variantId, notifiedAt: null }, take: 500 });
    const web = this.config.get('WEB_URL', { infer: true });
    const label = [variant.product.name, variant.color?.name, variant.size].filter(Boolean).join(' — ');
    for (const alert of alerts) {
      const prefix = alert.locale === 'tr' ? '' : `/${alert.locale}`;
      await this.mail.send(alert.email, templates.stockAlert(mailLocale(alert.locale), label, `${web}${prefix}/products/${variant.product.slug}`));
      await this.prisma.stockAlert.update({ where: { id: alert.id }, data: { notifiedAt: new Date() } });
    }
    if (alerts.length) this.logger.log(`restock: notified ${alerts.length} for ${variant.sku}`);
  }

  // ─────────────────────────── images ───────────────────────────

  async addImage(productId: string, dto: ImageDto) {
    await this.ensureProduct(productId);
    const last = await this.prisma.productImage.aggregate({ where: { productId }, _max: { sortOrder: true } });
    return this.prisma.productImage.create({ data: { ...dto, productId, sortOrder: dto.sortOrder ?? (last._max.sortOrder ?? -1) + 1 } });
  }

  updateImage(id: string, dto: UpdateImageDto) {
    return this.prisma.productImage.update({ where: { id }, data: dto });
  }

  async deleteImage(id: string) {
    await this.prisma.productImage.delete({ where: { id } });
    return { ok: true };
  }

  async reorderImages(productId: string, ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, sortOrder) => this.prisma.productImage.updateMany({ where: { id, productId }, data: { sortOrder } })),
    );
    return this.prisma.productImage.findMany({ where: { productId }, orderBy: { sortOrder: 'asc' } });
  }

  // ─────────────────────────── taxonomy ───────────────────────────

  listCategories() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
  }

  async createCategory(dto: CategoryDto) {
    const slug = await this.uniqueSlug('category', dto.slug ?? slugify(dto.name));
    return this.prisma.category.create({ data: { ...dto, slug, translations: json(dto.translations) } });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    if (dto.parentId === id) throw new BadRequestException('Kategori kendisinin alt kategorisi olamaz');
    const slug = dto.slug ? await this.uniqueSlug('category', dto.slug, id) : undefined;
    return this.prisma.category.update({ where: { id }, data: { ...dto, slug, translations: json(dto.translations) } });
  }

  async deleteCategory(id: string) {
    await this.prisma.category.delete({ where: { id } }); // products fall back to categoryId = null
    return { ok: true };
  }

  listCollections() {
    return this.prisma.collection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async createCollection(dto: CollectionDto) {
    const slug = await this.uniqueSlug('collection', dto.slug ?? slugify(dto.name));
    return this.prisma.collection.create({ data: { ...dto, slug, translations: json(dto.translations) } });
  }

  async updateCollection(id: string, dto: UpdateCollectionDto) {
    const slug = dto.slug ? await this.uniqueSlug('collection', dto.slug, id) : undefined;
    return this.prisma.collection.update({ where: { id }, data: { ...dto, slug, translations: json(dto.translations) } });
  }

  async deleteCollection(id: string) {
    await this.prisma.collection.delete({ where: { id } });
    return { ok: true };
  }

  listColors() {
    return this.prisma.color.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { variants: true } } } });
  }

  async createColor(dto: ColorDto) {
    const slug = await this.uniqueSlug('color', dto.slug ?? slugify(dto.name));
    return this.prisma.color.create({ data: { ...dto, slug, translations: json(dto.translations) } });
  }

  async updateColor(id: string, dto: UpdateColorDto) {
    const slug = dto.slug ? await this.uniqueSlug('color', dto.slug, id) : undefined;
    return this.prisma.color.update({ where: { id }, data: { ...dto, slug, translations: json(dto.translations) } });
  }

  async deleteColor(id: string) {
    const used = await this.prisma.productVariant.count({ where: { colorId: id, deletedAt: null } });
    if (used) throw new BadRequestException(`Bu renk ${used} varyantta kullanılıyor`);
    await this.prisma.color.delete({ where: { id } });
    return { ok: true };
  }

  // ─────────────────────────── helpers ───────────────────────────

  private async ensureProduct(id: string) {
    const exists = await this.prisma.product.count({ where: { id, deletedAt: null } });
    if (!exists) throw new NotFoundException('Ürün bulunamadı');
  }

  private assertUniqueVariantCombos(variants: VariantDto[]) {
    const keys = variants.map((v) => `${v.colorId ?? '-'}|${v.size ?? '-'}`);
    if (new Set(keys).size !== keys.length) throw new BadRequestException('Aynı renk/beden kombinasyonu iki kez girilmiş');
  }

  private async assertComboFree(productId: string, colorId: string | null, size: string | null, exceptId?: string) {
    const clash = await this.prisma.productVariant.findFirst({
      where: { productId, colorId, size, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (clash) throw new BadRequestException('Bu renk/beden kombinasyonu zaten var');
  }

  private async uniqueSlug(model: 'product' | 'category' | 'collection' | 'color', base: string, exceptId?: string) {
    const root = slugify(base) || 'item';
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? root : `${root}-${i + 1}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = this.prisma[model] as any;
      const hit = await delegate.findFirst({ where: { slug: candidate, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
      if (!hit) return candidate;
    }
    throw new BadRequestException('Uygun bir slug üretilemedi');
  }
}
