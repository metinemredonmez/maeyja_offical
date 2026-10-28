import { Injectable } from '@nestjs/common';
import { Coupon, CouponType, Prisma } from '@prisma/client';
import { Locale, localize } from '../../common/utils/i18n.util';
import { fromKurus, includedVatKurus, toKurus } from '../../common/utils/money.util';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export const quoteVariantInclude = {
  color: true,
  product: { include: { images: { orderBy: { sortOrder: 'asc' as const } } } },
} satisfies Prisma.ProductVariantInclude;

export type QuoteVariant = Prisma.ProductVariantGetPayload<{ include: typeof quoteVariantInclude }>;

export interface QuoteInput {
  lines: { variant: QuoteVariant; quantity: number }[];
  couponCode?: string | null;
  email?: string | null;
  lang?: Locale;
}

export interface QuoteLine {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string | null;
  sku: string;
  colorName: string | null;
  colorHex: string | null;
  size: string | null;
  imageUrl: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  taxRate: number;
  available: boolean;
  maxQuantity: number;
}

export interface Quote {
  lines: QuoteLine[];
  itemCount: number;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  currency: 'TRY';
  coupon: { code: string; type: CouponType; valid: boolean; message?: string } | null;
  freeShippingRemaining: number | null;
  allAvailable: boolean;
}

/**
 * The single place prices are computed. Cart display, checkout and the stored order all
 * come from `quote()`, so what the shopper sees is exactly what is charged.
 * Prices are VAT-inclusive; `taxTotal` is the VAT contained in `total`.
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async quote(input: QuoteInput): Promise<Quote> {
    const lang = input.lang ?? 'tr';
    const [shipping, tax, checkout] = await Promise.all([
      this.settings.get('shipping'),
      this.settings.get('tax'),
      this.settings.get('checkout'),
    ]);

    const lines: QuoteLine[] = input.lines.map(({ variant, quantity }) => {
      const p = variant.product;
      const unitKurus = toKurus(variant.price ?? p.basePrice);
      const colorName = variant.color ? localize({ name: variant.color.name, translations: variant.color.translations }, lang).name : null;
      const { name } = localize({ name: p.name, translations: p.translations }, lang);
      const image = p.images.find((i) => i.colorId && i.colorId === variant.colorId) ?? p.images[0];
      const live = variant.isActive && !variant.deletedAt && p.status === 'ACTIVE' && !p.deletedAt;
      const maxQuantity = live ? Math.min(variant.stock, checkout.maxQtyPerItem) : 0;
      return {
        variantId: variant.id,
        productId: p.id,
        productSlug: p.slug,
        productName: name,
        variantName: [colorName, variant.size].filter(Boolean).join(' / ') || null,
        sku: variant.sku,
        colorName,
        colorHex: variant.color?.hex ?? null,
        size: variant.size,
        imageUrl: image?.url ?? null,
        unitPrice: fromKurus(unitKurus),
        compareAtPrice: variant.compareAtPrice ?? p.compareAtPrice ? Number(variant.compareAtPrice ?? p.compareAtPrice) : null,
        quantity,
        lineTotal: fromKurus(unitKurus * quantity),
        taxRate: p.taxRate ?? tax.defaultRate,
        available: live && quantity <= maxQuantity,
        maxQuantity,
      };
    });

    const subtotalK = lines.reduce((s, l) => s + toKurus(l.lineTotal), 0);

    // Coupon
    let discountK = 0;
    let freeShippingByCoupon = false;
    let coupon: Quote['coupon'] = null;
    if (input.couponCode) {
      const check = await this.checkCoupon(input.couponCode, subtotalK, input.email);
      coupon = { code: input.couponCode.toUpperCase(), type: check.coupon?.type ?? CouponType.FIXED, valid: check.valid, message: check.message };
      if (check.valid && check.coupon) {
        const c = check.coupon;
        if (c.type === CouponType.PERCENT) {
          discountK = Math.round((subtotalK * Number(c.value)) / 100);
          if (c.maxDiscount) discountK = Math.min(discountK, toKurus(c.maxDiscount));
        } else if (c.type === CouponType.FIXED) {
          discountK = Math.min(toKurus(c.value), subtotalK);
        } else {
          freeShippingByCoupon = true;
        }
      }
    }

    // Shipping
    const afterDiscountK = subtotalK - discountK;
    const flatK = toKurus(shipping.flatRate);
    const thresholdK = toKurus(shipping.freeShippingThreshold);
    const freeByThreshold = thresholdK > 0 && afterDiscountK >= thresholdK;
    const shippingK = lines.length === 0 || flatK === 0 || freeByThreshold || freeShippingByCoupon ? 0 : flatK;

    // VAT contained in the total — discount is spread proportionally across lines.
    const ratio = subtotalK > 0 ? afterDiscountK / subtotalK : 0;
    const taxK =
      lines.reduce((s, l) => s + includedVatKurus(Math.round(toKurus(l.lineTotal) * ratio), l.taxRate), 0) +
      includedVatKurus(shippingK, tax.defaultRate);

    return {
      lines,
      itemCount: lines.reduce((s, l) => s + l.quantity, 0),
      subtotal: fromKurus(subtotalK),
      discountTotal: fromKurus(discountK),
      shippingTotal: fromKurus(shippingK),
      taxTotal: fromKurus(taxK),
      total: fromKurus(afterDiscountK + shippingK),
      currency: 'TRY',
      coupon,
      freeShippingRemaining: thresholdK > 0 && flatK > 0 && !freeByThreshold ? fromKurus(thresholdK - afterDiscountK) : null,
      allAvailable: lines.every((l) => l.available),
    };
  }

  async checkCoupon(code: string, subtotalKurus: number, email?: string | null): Promise<{ valid: boolean; message?: string; coupon?: Coupon }> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    const now = new Date();
    if (!coupon || !coupon.isActive) return { valid: false, message: 'Kupon bulunamadı' };
    if (coupon.startsAt && coupon.startsAt > now) return { valid: false, message: 'Kupon henüz aktif değil', coupon };
    if (coupon.endsAt && coupon.endsAt < now) return { valid: false, message: 'Kuponun süresi dolmuş', coupon };
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return { valid: false, message: 'Kupon kullanım limiti doldu', coupon };
    if (coupon.minOrderAmount && subtotalKurus < toKurus(coupon.minOrderAmount)) {
      return { valid: false, message: `Kupon en az ${Number(coupon.minOrderAmount)} ₺ alışverişte geçerli`, coupon };
    }
    if (email && coupon.usageLimitPerUser) {
      const used = await this.prisma.couponRedemption.count({ where: { couponId: coupon.id, email: email.toLowerCase() } });
      if (used >= coupon.usageLimitPerUser) return { valid: false, message: 'Bu kuponu daha önce kullandınız', coupon };
    }
    return { valid: true, coupon };
  }
}
