import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order, OrderItem, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Locale, storefrontPath } from '../../common/utils/i18n.util';
import { toKurus, toNumber } from '../../common/utils/money.util';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { CartOwner, CartService } from '../cart/cart.service';
import { SettingsService } from '../settings/settings.service';
import { CheckoutAddressDto, CheckoutDto } from './dto/orders.dto';
import { buildBasketItems } from './iyzico.basket';
import { CheckoutFormResult, IyzicoAddress, IyzicoClient } from './iyzico.client';
import { OrderLifecycleService } from './order-lifecycle.service';

type OrderWithItems = Order & { items: OrderItem[] };

type StoredAddress = CheckoutAddressDto & {
  invoiceType?: 'INDIVIDUAL' | 'CORPORATE';
  identityNumber?: string;
  companyName?: string;
  taxOffice?: string;
  taxNumber?: string;
};

export interface PaymentStart {
  provider: PaymentProvider;
  paymentPageUrl?: string;
  checkoutFormContent?: string;
  token?: string;
  bankTransfer?: { bankName: string; accountName: string; iban: string; note: string };
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly settings: SettingsService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly iyzico: IyzicoClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Cart → order. Stock is reserved (conditional decrement) in the same transaction that creates
   * the order, so two shoppers can never buy the last bag twice. The cart is emptied; an unpaid
   * order can be paid again via `retryPayment` until the expiry job cancels it.
   */
  async checkout(owner: CartOwner, user: AuthUser | undefined, dto: CheckoutDto, ip: string, lang: Locale) {
    if (!user) {
      const { guestCheckout } = await this.settings.get('checkout');
      if (!guestCheckout) throw new ForbiddenException('Sipariş vermek için giriş yapın');
    }
    if (dto.paymentMethod === PaymentProvider.BANK_TRANSFER && !(await this.settings.get('bankTransfer')).enabled) {
      throw new BadRequestException('Havale/EFT ile ödeme şu anda kapalı');
    }
    if (dto.paymentMethod === PaymentProvider.IYZICO && !this.iyzico.configured) {
      throw new BadRequestException('Kartla ödeme şu anda kullanılamıyor');
    }

    const cart = await this.cart.find(owner);
    if (!cart?.items.length) throw new BadRequestException('Sepetiniz boş');
    const email = user?.email ?? dto.email;
    const quote = await this.cart.view(cart, lang, email);
    if (!quote.allAvailable) throw new BadRequestException('Sepetinizdeki bazı ürünlerin stoğu değişti, lütfen sepeti kontrol edin');
    if (quote.coupon && !quote.coupon.valid) throw new BadRequestException(quote.coupon.message ?? 'Kupon geçersiz');

    const shipping = await this.resolveShippingAddress(user, dto);
    const billing: StoredAddress = {
      ...(dto.billingSameAsShipping === false && dto.billingAddress ? dto.billingAddress : shipping),
      invoiceType: dto.invoice?.type ?? 'INDIVIDUAL',
      identityNumber: dto.invoice?.identityNumber,
      companyName: dto.invoice?.companyName,
      taxOffice: dto.invoice?.taxOffice,
      taxNumber: dto.invoice?.taxNumber,
    };
    const coupon = quote.coupon?.valid ? await this.prisma.coupon.findUnique({ where: { code: quote.coupon.code } }) : null;

    const order = await this.prisma.$transaction(async (tx) => {
      for (const line of quote.lines) {
        const reserved = await tx.productVariant.updateMany({
          where: { id: line.variantId, isActive: true, deletedAt: null, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (reserved.count === 0) throw new BadRequestException(`${line.productName} için yeterli stok kalmadı`);
      }

      if (coupon) {
        const used = await tx.coupon.updateMany({
          where: { id: coupon.id, OR: [{ usageLimit: null }, { usedCount: { lt: tx.coupon.fields.usageLimit } }] },
          data: { usedCount: { increment: 1 } },
        });
        if (used.count === 0) throw new BadRequestException('Kupon kullanım limiti doldu');
      }

      const isFree = toKurus(quote.total) === 0;
      const created = await tx.order.create({
        data: {
          orderNumber: await this.nextOrderNumber(tx),
          userId: user?.id,
          email,
          phone: shipping.phone,
          status: isFree ? 'PAID' : 'PENDING_PAYMENT',
          paidAt: isFree ? new Date() : null,
          subtotal: quote.subtotal,
          discountTotal: quote.discountTotal,
          shippingTotal: quote.shippingTotal,
          taxTotal: quote.taxTotal,
          total: quote.total,
          couponCode: coupon?.code,
          paymentProvider: dto.paymentMethod,
          shippingAddress: shipping as unknown as Prisma.InputJsonValue,
          billingAddress: billing as unknown as Prisma.InputJsonValue,
          customerNote: dto.customerNote,
          locale: lang,
          ip,
          items: {
            create: quote.lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              productName: l.productName,
              variantName: l.variantName,
              sku: l.sku,
              colorName: l.colorName,
              size: l.size,
              imageUrl: l.imageUrl,
              unitPrice: l.unitPrice,
              quantity: l.quantity,
              lineTotal: l.lineTotal,
              taxRate: l.taxRate,
            })),
          },
          history: { create: { to: isFree ? 'PAID' : 'PENDING_PAYMENT', note: 'Sipariş oluşturuldu' } },
        },
        include: { items: true },
      });

      if (coupon) await tx.couponRedemption.create({ data: { couponId: coupon.id, orderId: created.id, email } });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
      return created;
    });

    await this.afterOrderSideEffects(user, dto, shipping, email, lang);

    if (order.status === 'PAID') {
      void this.lifecycle.notify(order.id, 'paid');
      return { order: this.summary(order), payment: null };
    }
    const payment = await this.startPayment(order, ip);
    if (order.paymentProvider === PaymentProvider.BANK_TRANSFER) void this.lifecycle.notify(order.id, 'received');
    return { order: this.summary(order), payment };
  }

  /** A shopper whose card was declined can try again on the same order (stock stays reserved). */
  async retryPayment(orderNumber: string, user: AuthUser | undefined, email: string | undefined, ip: string) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber }, include: { items: true } });
    const allowed = order && (user ? order.userId === user.id : email && order.email === email);
    if (!order || !allowed) throw new NotFoundException('Sipariş bulunamadı');
    if (order.status !== 'PENDING_PAYMENT') throw new BadRequestException('Bu sipariş için ödeme beklenmiyor');
    if (order.paymentProvider !== PaymentProvider.IYZICO) throw new BadRequestException('Bu sipariş havale/EFT ile ödenecek');
    return { order: this.summary(order), payment: await this.startPayment(order, ip) };
  }

  async startPayment(order: OrderWithItems, ip: string): Promise<PaymentStart> {
    if (order.paymentProvider === PaymentProvider.BANK_TRANSFER) {
      await this.prisma.payment.create({ data: { orderId: order.id, provider: PaymentProvider.BANK_TRANSFER, amount: order.total } });
      const bt = await this.settings.get('bankTransfer');
      return {
        provider: PaymentProvider.BANK_TRANSFER,
        bankTransfer: { bankName: bt.bankName, accountName: bt.accountName, iban: bt.iban, note: bt.note[order.locale] ?? bt.note.tr ?? '' },
      };
    }

    const payment = await this.prisma.payment.create({ data: { orderId: order.id, provider: PaymentProvider.IYZICO, amount: order.total } });
    const shipping = order.shippingAddress as unknown as StoredAddress;
    const billing = order.billingAddress as unknown as StoredAddress;
    const result = await this.iyzico.initializeCheckoutForm({
      locale: order.locale === 'tr' ? 'tr' : 'en', // iyzico only speaks tr/en
      conversationId: payment.id,
      price: toNumber(order.total).toFixed(2),
      paidPrice: toNumber(order.total).toFixed(2),
      currency: 'TRY',
      basketId: order.orderNumber,
      paymentGroup: 'PRODUCT',
      callbackUrl: `${this.config.get('API_URL', { infer: true })}/${this.config.get('API_PREFIX', { infer: true })}/payments/iyzico/callback`,
      enabledInstallments: [1, 2, 3, 6],
      buyer: {
        id: order.userId ?? `guest-${order.id}`,
        name: shipping.firstName,
        surname: shipping.lastName,
        gsmNumber: this.normalizePhone(shipping.phone),
        email: order.email,
        // iyzico accepts 11111111111 when the shopper didn't provide a TCKN.
        identityNumber: billing.identityNumber ?? '11111111111',
        registrationAddress: this.addressLine(shipping),
        ip,
        city: shipping.city,
        country: this.countryName(shipping.country),
        zipCode: shipping.postalCode,
      },
      shippingAddress: this.iyzicoAddress(shipping),
      billingAddress: this.iyzicoAddress(billing),
      basketItems: buildBasketItems(order),
    });

    if (result.status !== 'success' || !result.token) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, failureReason: result.errorMessage, raw: result as unknown as Prisma.InputJsonValue },
      });
      this.logger.warn(`iyzico init failed for ${order.orderNumber}: ${result.errorCode} ${result.errorMessage}`);
      throw new BadRequestException(`Ödeme başlatılamadı: ${result.errorMessage ?? 'bilinmeyen hata'}`);
    }

    await this.prisma.payment.update({ where: { id: payment.id }, data: { providerToken: result.token } });
    return {
      provider: PaymentProvider.IYZICO,
      token: result.token,
      paymentPageUrl: result.paymentPageUrl,
      checkoutFormContent: result.checkoutFormContent,
    };
  }

  /**
   * iyzico posts `token` here from the shopper's browser after 3-D Secure. We never trust the
   * post itself: the result is fetched server-to-server and checked against our own records.
   * Returns the storefront URL to redirect the shopper to.
   */
  async handleIyzicoCallback(token: string | undefined): Promise<string> {
    const web = this.config.get('WEB_URL', { infer: true });
    if (!token) return `${web}/checkout/result?status=failed`;

    const payment = await this.prisma.payment.findUnique({ where: { providerToken: token }, include: { order: { include: { items: true } } } });
    if (!payment) {
      this.logger.warn(`iyzico callback with unknown token`);
      return `${web}/checkout/result?status=failed`;
    }
    const order = payment.order;
    const resultUrl = (status: string) =>
      `${web}${storefrontPath(order.locale, `/checkout/result?order=${encodeURIComponent(order.orderNumber)}&status=${status}`)}`;

    if (payment.status === PaymentStatus.SUCCEEDED) return resultUrl('success'); // replayed callback

    const result = await this.iyzico.retrieveCheckoutForm(token, payment.id, order.locale === 'tr' ? 'tr' : 'en');
    const failure = this.verify(result, payment.id, order);

    if (failure) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED, failureReason: failure, raw: result as unknown as Prisma.InputJsonValue },
      });
      this.logger.warn(`payment failed ${order.orderNumber}: ${failure}`);
      return resultUrl('failed');
    }

    const outcome = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] } },
        data: {
          status: PaymentStatus.SUCCEEDED,
          providerPaymentId: result.paymentId,
          cardLast4: result.lastFourDigits,
          cardAssociation: result.cardAssociation,
          installment: result.installment,
          failureReason: null,
          raw: result as unknown as Prisma.InputJsonValue,
        },
      });
      if (claimed.count === 0) return 'duplicate' as const;

      const current = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
      if (current.status === 'PENDING_PAYMENT') {
        await this.lifecycle.transition(tx, current, 'PAID', { note: `iyzico ödeme ${result.paymentId}` });
        return 'paid' as const;
      }
      if (current.status === 'CANCELLED') {
        // Paid after the expiry job cancelled it: revive the order if the stock is still there.
        const revived = current.stockReleasedAt ? await this.lifecycle.reReserveStock(tx, current) : true;
        if (revived) {
          await tx.order.update({ where: { id: current.id }, data: { status: 'PAID', paidAt: new Date(), cancelledAt: null } });
          await tx.orderStatusHistory.create({ data: { orderId: current.id, from: 'CANCELLED', to: 'PAID', note: 'Geç gelen ödeme ile yeniden açıldı' } });
          return 'paid' as const;
        }
        await tx.order.update({
          where: { id: current.id },
          data: { adminNote: `${current.adminNote ?? ''}\n⚠ Ödeme alındı (${result.paymentId}) ama sipariş iptal ve stok yok — iade gerekli.`.trim() },
        });
        return 'needs_refund' as const;
      }
      return 'paid' as const;
    });

    if (outcome === 'paid') void this.lifecycle.notify(order.id, 'paid');
    if (outcome === 'needs_refund') this.logger.error(`order ${order.orderNumber} paid after cancellation without stock — refund needed`);
    return resultUrl(outcome === 'needs_refund' ? 'review' : 'success');
  }

  // ─────────────────────────── helpers ───────────────────────────

  private verify(r: CheckoutFormResult, conversationId: string, order: Order): string | null {
    if (r.status !== 'success') return r.errorMessage ?? 'iyzico status failure';
    if (r.paymentStatus !== 'SUCCESS') return `paymentStatus=${r.paymentStatus}`;
    if (r.fraudStatus === -1) return 'fraud check rejected';
    if (r.conversationId && r.conversationId !== conversationId) return 'conversationId mismatch';
    if (r.basketId !== order.orderNumber) return 'basketId mismatch';
    if (r.currency && r.currency !== 'TRY') return 'currency mismatch';
    // paidPrice may exceed price when the shopper picks an installment with interest.
    if (toKurus(r.price) !== toKurus(order.total) || toKurus(r.paidPrice) < toKurus(order.total)) return 'amount mismatch';
    return null;
  }

  private async resolveShippingAddress(user: AuthUser | undefined, dto: CheckoutDto): Promise<CheckoutAddressDto> {
    if (dto.shippingAddressId) {
      if (!user) throw new BadRequestException('Kayıtlı adres için giriş yapın');
      const a = await this.prisma.address.findFirst({ where: { id: dto.shippingAddressId, userId: user.id } });
      if (!a) throw new NotFoundException('Adres bulunamadı');
      return {
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone,
        country: a.country,
        city: a.city,
        district: a.district,
        line1: a.line1,
        line2: a.line2 ?? undefined,
        postalCode: a.postalCode ?? undefined,
      };
    }
    if (!dto.shippingAddress) throw new BadRequestException('Teslimat adresi gerekli');
    return { ...dto.shippingAddress, country: dto.shippingAddress.country ?? 'TR' };
  }

  private async afterOrderSideEffects(user: AuthUser | undefined, dto: CheckoutDto, shipping: CheckoutAddressDto, email: string, lang: Locale) {
    try {
      if (user && dto.saveAddress && dto.shippingAddress) {
        const count = await this.prisma.address.count({ where: { userId: user.id } });
        await this.prisma.address.create({ data: { ...shipping, country: shipping.country ?? 'TR', userId: user.id, isDefault: count === 0 } });
      }
      if (dto.subscribeNewsletter) {
        await this.prisma.newsletterSubscriber.upsert({
          where: { email },
          create: { email, locale: lang, source: 'checkout' },
          update: { unsubscribedAt: null },
        });
      }
    } catch (e) {
      this.logger.warn(`post-checkout side effects failed: ${(e as Error).message}`);
    }
  }

  private async nextOrderNumber(tx: Prisma.TransactionClient) {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < 10; i++) {
      const candidate = `MY-${ymd}-${randomInt(1000, 9999)}`;
      if (!(await tx.order.count({ where: { orderNumber: candidate } }))) return candidate;
    }
    return `MY-${ymd}-${Date.now().toString(36).toUpperCase()}`;
  }

  private summary(order: OrderWithItems) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      email: order.email,
      total: toNumber(order.total),
      paymentProvider: order.paymentProvider,
    };
  }

  private iyzicoAddress(a: StoredAddress): IyzicoAddress {
    return {
      contactName: a.companyName ?? `${a.firstName} ${a.lastName}`,
      city: a.city,
      country: this.countryName(a.country),
      address: this.addressLine(a),
      zipCode: a.postalCode,
    };
  }

  private addressLine(a: CheckoutAddressDto) {
    return [a.line1, a.line2, a.district, a.city].filter(Boolean).join(', ');
  }

  private countryName(code?: string) {
    return !code || code === 'TR' ? 'Turkey' : code;
  }

  private normalizePhone(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('90') && digits.length === 12) return `+${digits}`;
    if (digits.startsWith('0') && digits.length === 11) return `+9${digits}`;
    if (digits.length === 10) return `+90${digits}`;
    return `+${digits}`;
  }
}
