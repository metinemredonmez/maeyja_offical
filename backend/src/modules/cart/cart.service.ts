import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Locale } from '../../common/utils/i18n.util';
import { generateToken } from '../../common/utils/token.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingService, quoteVariantInclude } from '../pricing/pricing.service';
import { SettingsService } from '../settings/settings.service';

export interface CartOwner {
  userId?: string;
  guestToken?: string;
}

const cartInclude = {
  items: { orderBy: { createdAt: 'asc' }, include: { variant: { include: quoteVariantInclude } } },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly settings: SettingsService,
  ) {}

  async get(owner: CartOwner, lang: Locale, email?: string) {
    const cart = await this.find(owner);
    return this.view(cart, lang, email);
  }

  async addItem(owner: CartOwner, variantId: string, quantity: number, lang: Locale) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, isActive: true, deletedAt: null, product: { status: 'ACTIVE', deletedAt: null } },
    });
    if (!variant) throw new NotFoundException('Ürün bulunamadı');
    const cart = (await this.find(owner)) ?? (await this.create(owner));
    const existing = cart.items.find((i) => i.variantId === variantId);
    await this.assertQuantity(variant.stock, (existing?.quantity ?? 0) + quantity);
    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: { cartId: cart.id, variantId, quantity },
      update: { quantity: { increment: quantity } },
    });
    return this.view(await this.reload(cart.id), lang);
  }

  async setQuantity(owner: CartOwner, variantId: string, quantity: number, lang: Locale) {
    const cart = await this.require(owner);
    const item = cart.items.find((i) => i.variantId === variantId);
    if (!item) throw new NotFoundException('Sepette böyle bir ürün yok');
    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      await this.assertQuantity(item.variant.stock, quantity);
      await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    }
    return this.view(await this.reload(cart.id), lang);
  }

  async removeItem(owner: CartOwner, variantId: string, lang: Locale) {
    const cart = await this.require(owner);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
    return this.view(await this.reload(cart.id), lang);
  }

  async applyCoupon(owner: CartOwner, code: string, lang: Locale, email?: string) {
    const cart = await this.require(owner);
    const quote = await this.view(cart, lang, email);
    const check = await this.pricing.checkCoupon(code, Math.round(quote.subtotal * 100), email);
    if (!check.valid) throw new BadRequestException(check.message);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: code.trim().toUpperCase() } });
    return this.view(await this.reload(cart.id), lang, email);
  }

  async removeCoupon(owner: CartOwner, lang: Locale) {
    const cart = await this.require(owner);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    return this.view(await this.reload(cart.id), lang);
  }

  async clear(owner: CartOwner) {
    const cart = await this.find(owner);
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { ok: true };
  }

  /** After login: move the guest cart into the user's cart (quantities add up, capped by stock). */
  async merge(userId: string, guestToken: string, lang: Locale) {
    const guest = await this.prisma.cart.findUnique({ where: { guestToken }, include: cartInclude });
    const userCart = (await this.find({ userId })) ?? (await this.create({ userId }));
    if (guest && guest.id !== userCart.id) {
      const { maxQtyPerItem } = await this.settings.get('checkout');
      for (const item of guest.items) {
        const current = userCart.items.find((i) => i.variantId === item.variantId)?.quantity ?? 0;
        const quantity = Math.min(current + item.quantity, item.variant.stock, maxQtyPerItem);
        if (quantity <= 0) continue;
        await this.prisma.cartItem.upsert({
          where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
          create: { cartId: userCart.id, variantId: item.variantId, quantity },
          update: { quantity },
        });
      }
      if (guest.couponCode && !userCart.couponCode) {
        await this.prisma.cart.update({ where: { id: userCart.id }, data: { couponCode: guest.couponCode } });
      }
      await this.prisma.cart.delete({ where: { id: guest.id } });
    }
    return this.view(await this.reload(userCart.id), lang);
  }

  // ─────────────────────────── internals (also used by checkout) ───────────────────────────

  find(owner: CartOwner): Promise<CartWithItems | null> {
    if (owner.userId) return this.prisma.cart.findUnique({ where: { userId: owner.userId }, include: cartInclude });
    if (owner.guestToken) return this.prisma.cart.findUnique({ where: { guestToken: owner.guestToken }, include: cartInclude });
    return Promise.resolve(null);
  }

  async view(cart: CartWithItems | null, lang: Locale, email?: string) {
    const quote = await this.pricing.quote({
      lines: (cart?.items ?? []).map((i) => ({ variant: i.variant, quantity: i.quantity })),
      couponCode: cart?.couponCode,
      email,
      lang,
    });
    return { id: cart?.id ?? null, cartToken: cart?.guestToken ?? null, ...quote };
  }

  private async require(owner: CartOwner) {
    const cart = await this.find(owner);
    if (!cart) throw new NotFoundException('Sepet bulunamadı');
    return cart;
  }

  private create(owner: CartOwner) {
    return this.prisma.cart.create({
      data: owner.userId ? { userId: owner.userId } : { guestToken: generateToken(24) },
      include: cartInclude,
    });
  }

  private reload(id: string) {
    return this.prisma.cart.findUniqueOrThrow({ where: { id }, include: cartInclude });
  }

  private async assertQuantity(stock: number, quantity: number) {
    const { maxQtyPerItem } = await this.settings.get('checkout');
    if (quantity > maxQtyPerItem) throw new BadRequestException(`Bir üründen en fazla ${maxQtyPerItem} adet alınabilir`);
    if (quantity > stock) throw new BadRequestException(stock > 0 ? `Stokta yalnızca ${stock} adet var` : 'Ürün stokta yok');
  }
}
