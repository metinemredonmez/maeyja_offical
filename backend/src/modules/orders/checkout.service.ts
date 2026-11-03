import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order, OrderItem, Payment, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import Stripe from 'stripe';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Locale, storefrontPath } from '../../common/utils/i18n.util';
import { toKurus, toNumber } from '../../common/utils/money.util';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { CartOwner, CartService } from '../cart/cart.service';
import { SettingsService } from '../settings/settings.service';
import { CheckoutAddressDto, CheckoutDto } from './dto/orders.dto';
import { buildBasketItems } from './iyzico.basket';
import { IyzicoAddress, IyzicoClient } from './iyzico.client';
import { OrderLifecycleService } from './order-lifecycle.service';
import { iyzicoVerdict, stripeVerdict, Verdict } from './payment-verdict';
import { StripeClient } from './stripe.client';

type OrderWithItems = Order & { items: OrderItem[] };
type PaymentWithOrder = Payment & { order: OrderWithItems };

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

/**
 * - paid: this payment paid the order · already_paid: nothing new (replay, or staff had marked it paid)
 * - duplicate: a second charge on a paid order (refunded automatically) · needs_refund: paid after cancel, no stock
 * - review / wait / failed: see Verdict
 */
export type SettleOutcome = 'paid' | 'already_paid' | 'duplicate' | 'needs_refund' | 'review' | 'wait' | 'failed';

/** Marks a card payment staff must look at; the expiry job leaves its order alone. */
export const PAYMENT_REVIEW = 'İnceleme:';

const CARD_PROVIDERS: PaymentProvider[] = [PaymentProvider.STRIPE, PaymentProvider.IYZICO];
/** Stripe accepts 30 min – 24 h; one minute over the minimum so clock drift can't make it too short. */
const STRIPE_SESSION_MINUTES = 31;
/** An iyzico form lives 30 minutes; within this a retry reopens the same form instead of a second one. */
const IYZICO_REUSE_MINUTES = 25;
/** Unpaid orders hold stock: per shopper (email) and per network (IP). */
const MAX_OPEN_ORDERS = { email: 3, ip: 5 };

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly settings: SettingsService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly iyzico: IyzicoClient,
    private readonly stripe: StripeClient,
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
    if (dto.paymentMethod !== PaymentProvider.BANK_TRANSFER && !this.cardProviderReady(dto.paymentMethod)) {
      throw new BadRequestException('Kartla ödeme şu anda kullanılamıyor');
    }

    const cart = await this.cart.find(owner);
    if (!cart?.items.length) throw new BadRequestException('Sepetiniz boş');
    const email = (user?.email ?? dto.email).toLowerCase();
    await this.assertFewOpenOrders(email, ip);
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
      // BUS-02: claim the cart first. A second checkout of the same cart (double click, two tabs) waits
      // on these rows, then finds them gone and rolls back instead of creating a second order.
      const claimed = await tx.cartItem.deleteMany({ where: { id: { in: cart.items.map((i) => i.id) } } });
      if (claimed.count !== cart.items.length) throw new ConflictException('Sepetiniz başka bir sekmede değişti, lütfen tekrar deneyin');

      for (const line of quote.lines) {
        const reserved = await tx.productVariant.updateMany({
          where: { id: line.variantId, isActive: true, deletedAt: null, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (reserved.count === 0) throw new BadRequestException(`${line.productName} için yeterli stok kalmadı`);
      }

      if (coupon) {
        if (coupon.usageLimitPerUser) {
          // Serialises checkouts of this coupon by this email, so the per-person limit is counted race-free.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${coupon.id}:${email}`}))`;
          const used = await tx.couponRedemption.count({ where: { couponId: coupon.id, email } });
          if (used >= coupon.usageLimitPerUser) throw new BadRequestException('Bu kuponu daha önce kullandınız');
        }
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
          ...(dto.attribution ? { attribution: { ...dto.attribution } } : {}),
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

  /**
   * A shopper whose card was declined (or who closed the payment page) can try again on the same order;
   * stock stays reserved. BUS-02: while an earlier payment page is still open it is reopened instead of
   * starting a second one, so the same order can't be charged twice from two tabs.
   */
  async retryPayment(orderNumber: string, user: AuthUser | undefined, email: string | undefined, ip: string) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber }, include: { items: true } });
    const allowed = order && (user ? order.userId === user.id : email && order.email === email);
    if (!order || !allowed) throw new NotFoundException('Sipariş bulunamadı');
    if (order.status !== 'PENDING_PAYMENT') throw new BadRequestException('Bu sipariş için ödeme beklenmiyor');
    if (!CARD_PROVIDERS.includes(order.paymentProvider)) throw new BadRequestException('Bu sipariş havale/EFT ile ödenecek');
    if (!this.cardProviderReady(order.paymentProvider)) throw new BadRequestException('Kartla ödeme şu anda kullanılamıyor');

    const open = await this.prisma.payment.findMany({
      where: { orderId: order.id, status: PaymentStatus.PENDING, providerToken: { not: null } },
      include: { order: { include: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
    for (const p of open) {
      if (p.failureReason?.startsWith(PAYMENT_REVIEW)) throw new BadRequestException('Ödemeniz kontrol ediliyor, ekibimiz sizinle iletişime geçecek');
      if (p.provider === PaymentProvider.STRIPE) {
        const session = await this.stripe.retrieveSession(p.providerToken!);
        if (session.status === 'open' && session.url) return { order: this.summary(order), payment: { provider: p.provider, token: session.id, paymentPageUrl: session.url } };
        const outcome = await this.settle(p, this.stripeVerdictFor(session, p));
        if (outcome !== 'failed') throw new BadRequestException('Bu sipariş için ödeme alındı, sayfayı yenileyin');
      } else if (p.provider === PaymentProvider.IYZICO) {
        const page = (p.raw as { paymentPageUrl?: string } | null)?.paymentPageUrl;
        if (page && Date.now() - p.createdAt.getTime() < IYZICO_REUSE_MINUTES * 60_000) {
          return { order: this.summary(order), payment: { provider: p.provider, token: p.providerToken!, paymentPageUrl: page } };
        }
      }
    }
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
    return order.paymentProvider === PaymentProvider.STRIPE ? this.startStripe(order) : this.startIyzico(order, ip);
  }

  /** Stripe-hosted payment page; lines, shipping and our discount are shown as they are on the order. */
  private async startStripe(order: OrderWithItems): Promise<PaymentStart> {
    const payment = await this.prisma.payment.create({ data: { orderId: order.id, provider: PaymentProvider.STRIPE, amount: order.total } });
    const web = this.config.get('WEB_URL', { infer: true });
    const api = `${this.config.get('API_URL', { infer: true })}/${this.config.get('API_PREFIX', { infer: true })}`;
    const metadata = { orderId: order.id, orderNumber: order.orderNumber, paymentId: payment.id };
    const discountK = toKurus(order.discountTotal);
    const shippingK = toKurus(order.shippingTotal);

    let session: Stripe.Checkout.Session;
    try {
      const coupon = discountK > 0 ? await this.stripe.createCoupon(discountK, order.couponCode ?? 'İndirim', `coupon-${payment.id}`) : null;
      session = await this.stripe.createSession(
        {
          mode: 'payment',
          client_reference_id: payment.id,
          customer_email: order.email,
          locale: order.locale as Stripe.Checkout.SessionCreateParams.Locale,
          line_items: order.items.map((i) => ({
            quantity: i.quantity,
            price_data: {
              currency: 'try',
              unit_amount: toKurus(i.unitPrice),
              product_data: { name: [i.productName, i.variantName].filter(Boolean).join(' — '), ...(i.imageUrl?.startsWith('https://') ? { images: [i.imageUrl] } : {}) },
            },
          })),
          ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
          ...(shippingK > 0
            ? { shipping_options: [{ shipping_rate_data: { type: 'fixed_amount' as const, display_name: 'Kargo', fixed_amount: { amount: shippingK, currency: 'try' } } }] }
            : {}),
          metadata,
          payment_intent_data: { description: `MAEYJA ${order.orderNumber}`, metadata },
          expires_at: Math.floor(Date.now() / 1000) + STRIPE_SESSION_MINUTES * 60,
          success_url: `${api}/payments/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${web}${storefrontPath(order.locale, `/checkout/result?order=${encodeURIComponent(order.orderNumber)}&status=failed`)}`,
        },
        `session-${payment.id}`,
      );
    } catch (e) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED, failureReason: (e as Error).message.slice(0, 500) } });
      this.logger.warn(`Stripe session failed for ${order.orderNumber}: ${(e as Error).message}`);
      // The shopper gets a plain message; Stripe's own text stays in the payment record for staff.
      if (e instanceof ServiceUnavailableException) throw e;
      throw new BadRequestException('Ödeme başlatılamadı, lütfen tekrar deneyin');
    }

    await this.prisma.payment.update({ where: { id: payment.id }, data: { providerToken: session.id } });
    return { provider: PaymentProvider.STRIPE, token: session.id, paymentPageUrl: session.url ?? undefined };
  }

  private async startIyzico(order: OrderWithItems, ip: string): Promise<PaymentStart> {
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

    // The page is kept so a retry within the form's lifetime reopens it (see retryPayment).
    await this.prisma.payment.update({ where: { id: payment.id }, data: { providerToken: result.token, raw: { paymentPageUrl: result.paymentPageUrl ?? null } } });
    return {
      provider: PaymentProvider.IYZICO,
      token: result.token,
      paymentPageUrl: result.paymentPageUrl,
      checkoutFormContent: result.checkoutFormContent,
    };
  }

  // ─────────────────────────── provider answers ───────────────────────────

  /**
   * iyzico posts `token` here from the shopper's browser after 3-D Secure. We never trust the
   * post itself: the result is fetched server-to-server and checked against our own records.
   * Returns the storefront URL to redirect the shopper to.
   */
  async handleIyzicoCallback(token: string | undefined): Promise<string> {
    return this.returnUrl(token ? await this.prisma.payment.findUnique({ where: { providerToken: token }, include: { order: { include: { items: true } } } }) : null, PaymentProvider.IYZICO);
  }

  /** Stripe's success_url lands here; the session is fetched from Stripe, never taken from the URL. */
  async handleStripeReturn(sessionId: string | undefined): Promise<string> {
    return this.returnUrl(sessionId ? await this.prisma.payment.findUnique({ where: { providerToken: sessionId }, include: { order: { include: { items: true } } } }) : null, PaymentProvider.STRIPE);
  }

  /**
   * Signed Stripe events. The event only tells us which session to look at again: its current state
   * (with the charge) is fetched from Stripe, so late or out-of-order events can't undo anything.
   */
  async handleStripeWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    const event = this.stripe.parseWebhook(rawBody, signature);
    if (!event.type.startsWith('checkout.session.')) return;
    const session = event.data.object as Stripe.Checkout.Session;
    const payment = await this.prisma.payment.findUnique({ where: { providerToken: session.id }, include: { order: { include: { items: true } } } });
    if (!payment) {
      this.logger.warn(`Stripe ${event.type} for unknown session`);
      return;
    }
    const outcome = await this.reconcile(payment);
    this.logger.log(`Stripe ${event.type} ${payment.order.orderNumber}: ${outcome}`);
  }

  /**
   * EXT-04 / ARC-05: before the expiry job cancels an unpaid card order, the provider is asked about every
   * payment still open on it; open Stripe pages are expired first so nothing can be paid after the cancel.
   * False: the order stays (paid now, under review or not final yet). Throws 503 when the provider is down.
   * Also used when staff cancel an unpaid card order by hand (`staff`).
   */
  async readyToExpire(orderId: string, opts: { staff?: boolean } = {}): Promise<boolean> {
    const open = await this.prisma.payment.findMany({
      where: { orderId, status: PaymentStatus.PENDING, providerToken: { not: null } },
      include: { order: { include: { items: true } } },
    });
    for (const p of open) {
      // Under review: the job waits for staff; staff themselves may cancel after checking the panel.
      if (p.failureReason?.startsWith(PAYMENT_REVIEW)) {
        if (opts.staff) continue;
        return false;
      }
      if (!this.providerConfigured(p.provider)) {
        // Keys removed since (e.g. iyzico switched off): nobody can be asked, so the order expires as before.
        this.logger.warn(`${p.provider} not configured; expiring ${p.order.orderNumber} without asking`);
        continue;
      }
      if ((await this.reconcile(p, { expireOpen: true })) !== 'failed') return false;
    }
    return true;
  }

  /** Asks the provider about one card payment and records the answer. */
  private async reconcile(payment: PaymentWithOrder, opts: { expireOpen?: boolean } = {}): Promise<SettleOutcome> {
    if (!payment.providerToken) return 'failed';
    if (payment.provider === PaymentProvider.STRIPE) {
      let session = await this.stripe.retrieveSession(payment.providerToken);
      if (session.status === 'open' && opts.expireOpen) {
        // A Stripe refusal here means the session closed meanwhile; its fresh state below decides.
        await this.stripe.expireSession(session.id).catch((e: unknown) => {
          if (!(e instanceof BadRequestException)) throw e;
        });
        session = await this.stripe.retrieveSession(session.id);
      }
      return this.settle(payment, this.stripeVerdictFor(session, payment));
    }
    if (payment.provider === PaymentProvider.IYZICO) {
      const result = await this.iyzico.retrieveCheckoutForm(payment.providerToken, payment.id, payment.order.locale === 'tr' ? 'tr' : 'en');
      return this.settle(payment, iyzicoVerdict(result, this.iyzico.checkoutFormSignatureValid(result), this.expected(payment)));
    }
    return 'wait';
  }

  private async returnUrl(payment: PaymentWithOrder | null, provider: PaymentProvider): Promise<string> {
    const web = this.config.get('WEB_URL', { infer: true });
    if (!payment || payment.provider !== provider) {
      this.logger.warn(`${provider} return with unknown token`);
      return `${web}/checkout/result?status=failed`;
    }
    const order = payment.order;
    const resultUrl = (status: string) => `${web}${storefrontPath(order.locale, `/checkout/result?order=${encodeURIComponent(order.orderNumber)}&status=${status}`)}`;
    if (payment.status === PaymentStatus.SUCCEEDED) return resultUrl('success'); // replayed return

    let outcome: SettleOutcome;
    try {
      outcome = await this.reconcile(payment);
    } catch (e) {
      // Provider unreachable right now: the webhook / expiry job settle it later, the shopper sees "checking".
      this.logger.error(`could not settle ${order.orderNumber}: ${(e as Error).message}`);
      return resultUrl('review');
    }
    if (outcome === 'failed') return resultUrl('failed');
    return resultUrl(outcome === 'paid' || outcome === 'already_paid' || outcome === 'duplicate' ? 'success' : 'review');
  }

  /** Records a provider's answer. Idempotent: every path (return, webhook, job) may see the same payment. */
  private async settle(payment: PaymentWithOrder, v: Verdict): Promise<SettleOutcome> {
    const order = payment.order;
    if (v.kind === 'wait') return 'wait';
    const raw = v.raw as Prisma.InputJsonValue;

    if (v.kind === 'failed') {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED, failureReason: v.reason.slice(0, 500), raw },
      });
      this.logger.warn(`payment failed ${order.orderNumber}: ${v.reason}`);
      return 'failed';
    }

    if (v.kind === 'review') {
      const flagged = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING, OR: [{ failureReason: null }, { NOT: { failureReason: { startsWith: PAYMENT_REVIEW } } }] },
        data: { failureReason: `${PAYMENT_REVIEW} ${v.reason}`.slice(0, 500), providerPaymentId: v.providerPaymentId, raw },
      });
      if (flagged.count) {
        const panel = payment.provider === PaymentProvider.STRIPE ? 'Stripe' : 'iyzico';
        await this.addAdminNote(order.id, `⚠ Ödeme incelemede: ${v.reason}. ${panel} panelinden kontrol edin; tamamsa siparişi "Ödendi", değilse "İptal" yapın.`);
        this.logger.error(`payment needs review ${order.orderNumber}: ${v.reason}`);
      }
      return 'review';
    }

    const outcome = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] } },
        data: {
          status: PaymentStatus.SUCCEEDED,
          providerPaymentId: v.providerPaymentId,
          cardLast4: v.cardLast4,
          cardAssociation: v.cardAssociation,
          installment: v.installment,
          failureReason: null,
          raw,
        },
      });
      if (claimed.count === 0) return 'already_paid' as const; // replay: settled before

      const current = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
      if (current.status === 'PENDING_PAYMENT') {
        await this.lifecycle.transition(tx, current, 'PAID', { note: v.note });
        return 'paid' as const;
      }
      if (current.status === 'CANCELLED') {
        // Paid after the expiry job cancelled it: revive the order if the stock is still there.
        const revived = current.stockReleasedAt ? await this.lifecycle.reReserveStock(tx, current) : true;
        if (revived) {
          // BUS-01: conditional, so a concurrent status change rolls this back instead of being overwritten.
          const reopened = await tx.order.updateMany({ where: { id: current.id, status: 'CANCELLED' }, data: { status: 'PAID', paidAt: new Date(), cancelledAt: null } });
          if (reopened.count === 0) throw new ConflictException('Sipariş aynı anda değişti');
          await tx.orderStatusHistory.create({ data: { orderId: current.id, from: 'CANCELLED', to: 'PAID', note: 'Geç gelen ödeme ile yeniden açıldı' } });
          return 'paid' as const;
        }
        await tx.order.update({
          where: { id: current.id },
          data: { adminNote: `${current.adminNote ?? ''}\n⚠ Ödeme alındı (${v.providerPaymentId}) ama sipariş iptal ve stok yok — iade gerekli.`.trim() },
        });
        return 'needs_refund' as const;
      }
      // Already paid. By another charge of ours → this one is a duplicate; otherwise staff marked it paid.
      const charged = await tx.payment.count({ where: { orderId: order.id, id: { not: payment.id }, status: PaymentStatus.SUCCEEDED, providerPaymentId: { not: null } } });
      return charged > 0 ? ('duplicate' as const) : ('already_paid' as const);
    });

    if (outcome === 'paid') void this.lifecycle.notify(order.id, 'paid');
    if (outcome === 'needs_refund') this.logger.error(`order ${order.orderNumber} paid after cancellation without stock — refund needed`);
    if (outcome === 'duplicate') await this.refundDuplicate(payment, v.providerPaymentId);
    return outcome;
  }

  /** BUS-02: a second successful charge for an order that is already paid goes straight back to the shopper. */
  private async refundDuplicate(payment: PaymentWithOrder, providerPaymentId: string | undefined) {
    let note: string;
    try {
      await this.refundPayment({ ...payment, providerPaymentId: providerPaymentId ?? null }, payment.order.ip ?? '127.0.0.1');
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.REFUNDED } });
      note = `İkinci ödeme (${providerPaymentId}) otomatik iade edildi.`;
    } catch (e) {
      note = `⚠ İkinci ödeme alındı (${providerPaymentId}) ama otomatik iade edilemedi — ödeme panelinden iade edin.`;
      this.logger.error(`duplicate charge on ${payment.order.orderNumber} not refunded: ${(e as Error).message}`);
    }
    await this.addAdminNote(payment.orderId, note);
  }

  /** Gives a card payment back on the provider. iyzico can only cancel on the same day (afterwards from its panel). */
  async refundPayment(p: Pick<Payment, 'id' | 'provider' | 'providerPaymentId'>, ip: string) {
    if (!p.providerPaymentId) throw new BadRequestException('Ödemenin sağlayıcı kimliği yok, panelden iade edin');
    if (p.provider === PaymentProvider.STRIPE) {
      await this.stripe.refund(p.providerPaymentId, `refund-${p.id}`);
      return;
    }
    if (p.provider === PaymentProvider.IYZICO) {
      const r = await this.iyzico.cancelPayment(p.providerPaymentId, ip, p.id);
      if (r.status !== 'success') throw new BadRequestException(`iyzico iptal edilemedi (${r.errorMessage}). Ödemeyi iyzico panelinden iade edip tekrar deneyin.`);
      return;
    }
    throw new BadRequestException('Bu ödeme yöntemi otomatik iade edilemez');
  }

  // ─────────────────────────── helpers ───────────────────────────

  /** The card provider shoppers may use now (CARD_PROVIDER), and only once its keys are set. */
  private cardProviderReady(provider: PaymentProvider) {
    return provider === this.config.get('CARD_PROVIDER', { infer: true }) && this.providerConfigured(provider);
  }

  private providerConfigured(provider: PaymentProvider) {
    return provider === PaymentProvider.STRIPE ? this.stripe.configured : provider === PaymentProvider.IYZICO && this.iyzico.configured;
  }

  /** BUS-02: unpaid orders hold stock, so one shopper or one network can't lock up the catalogue. */
  private async assertFewOpenOrders(email: string, ip: string) {
    const [byEmail, byIp] = await Promise.all([
      this.prisma.order.count({ where: { status: 'PENDING_PAYMENT', email } }),
      this.prisma.order.count({ where: { status: 'PENDING_PAYMENT', ip } }),
    ]);
    if (byEmail >= MAX_OPEN_ORDERS.email || byIp >= MAX_OPEN_ORDERS.ip) {
      throw new BadRequestException('Ödenmemiş siparişleriniz var. Önce onları tamamlayın ya da birkaç dakika sonra tekrar deneyin.');
    }
  }

  private expected(payment: PaymentWithOrder) {
    return { paymentId: payment.id, orderId: payment.order.id, orderNumber: payment.order.orderNumber, totalKurus: toKurus(payment.order.total) };
  }

  private stripeVerdictFor(session: Stripe.Checkout.Session, payment: PaymentWithOrder) {
    return stripeVerdict(session, this.expected(payment));
  }

  private async addAdminNote(orderId: string, line: string) {
    const current = await this.prisma.order.findUnique({ where: { id: orderId }, select: { adminNote: true } });
    await this.prisma.order.update({ where: { id: orderId }, data: { adminNote: `${current?.adminNote ?? ''}\n${line}`.trim() } });
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
