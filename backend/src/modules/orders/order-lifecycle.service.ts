import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order, OrderItem, OrderStatus, PaymentProvider, Prisma } from '@prisma/client';
import { toNumber } from '../../common/utils/money.util';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { mailLocale, OrderMailData, templates } from '../notifications/mail.templates';
import { PushService } from '../notifications/push.service';
import { SettingsService } from '../settings/settings.service';

type Tx = Prisma.TransactionClient;

/** Allowed manual transitions. Payment-driven ones (PENDING_PAYMENT → PAID) go through the same table. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'SHIPPED', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export const PAID_STATUSES: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

type OrderWithItems = Order & { items: OrderItem[] };

@Injectable()
export class OrderLifecycleService {
  private readonly logger = new Logger(OrderLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  assertTransition(from: OrderStatus, to: OrderStatus) {
    if (from === to) return;
    if (!TRANSITIONS[from].includes(to)) throw new BadRequestException(`Sipariş durumu ${from} → ${to} olarak değiştirilemez`);
  }

  /** Conditional update on the current status, so two concurrent writers can't both win. */
  async transition(tx: Tx, order: Pick<Order, 'id' | 'status'>, to: OrderStatus, opts: { note?: string; actorId?: string; data?: Prisma.OrderUpdateManyMutationInput } = {}) {
    this.assertTransition(order.status, to);
    const stamp: Prisma.OrderUpdateManyMutationInput =
      to === 'PAID' ? { paidAt: new Date() } : to === 'SHIPPED' ? { shippedAt: new Date() } : to === 'DELIVERED' ? { deliveredAt: new Date() } : to === 'CANCELLED' ? { cancelledAt: new Date() } : {};
    const res = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: to, ...stamp, ...opts.data } });
    if (res.count === 0) throw new BadRequestException('Sipariş başka bir işlem tarafından güncellendi, sayfayı yenileyin');
    await tx.orderStatusHistory.create({ data: { orderId: order.id, from: order.status, to, note: opts.note, actorId: opts.actorId } });
  }

  /** Puts reserved stock back and frees the coupon use. Idempotent via `stockReleasedAt`. */
  async releaseStock(tx: Tx, orderId: string) {
    const claimed = await tx.order.updateMany({ where: { id: orderId, stockReleasedAt: null }, data: { stockReleasedAt: new Date() } });
    if (claimed.count === 0) return false;
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      if (!item.variantId) continue;
      await tx.productVariant.updateMany({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
    }
    const redemption = await tx.couponRedemption.findUnique({ where: { orderId } });
    if (redemption) {
      await tx.couponRedemption.delete({ where: { id: redemption.id } });
      await tx.coupon.updateMany({ where: { id: redemption.couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
    }
    return true;
  }

  /** Re-reserves stock for an order whose stock had been released (late payment). */
  async reReserveStock(tx: Tx, order: OrderWithItems) {
    for (const item of order.items) {
      if (!item.variantId) continue;
      const ok = await tx.productVariant.updateMany({
        where: { id: item.variantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (ok.count === 0) return false;
    }
    await tx.order.update({ where: { id: order.id }, data: { stockReleasedAt: null } });
    return true;
  }

  trackingUrl(carriers: { code: string; name: string; trackingUrl: string }[], carrier: string, trackingNumber: string) {
    const c = carriers.find((x) => x.code === carrier || x.name === carrier);
    return c ? c.trackingUrl.replace('{tracking}', encodeURIComponent(trackingNumber)) : null;
  }

  // ─────────────────────────── notifications ───────────────────────────

  orderUrl(order: Pick<Order, 'orderNumber' | 'locale' | 'userId'>) {
    const web = this.config.get('WEB_URL', { infer: true });
    const prefix = order.locale === 'tr' ? '' : `/${order.locale}`;
    return order.userId ? `${web}${prefix}/account/orders/${order.orderNumber}` : `${web}${prefix}/order-status?order=${order.orderNumber}`;
  }

  async mailData(order: OrderWithItems): Promise<OrderMailData> {
    const shipping = order.shippingAddress as { firstName?: string };
    let bankTransfer: OrderMailData['bankTransfer'] = null;
    if (order.paymentProvider === PaymentProvider.BANK_TRANSFER && order.status === 'PENDING_PAYMENT') {
      const bt = await this.settings.get('bankTransfer');
      bankTransfer = { bankName: bt.bankName, accountName: bt.accountName, iban: bt.iban, note: bt.note[order.locale] ?? bt.note.tr ?? '' };
    }
    return {
      orderNumber: order.orderNumber,
      firstName: shipping?.firstName,
      total: toNumber(order.total),
      subtotal: toNumber(order.subtotal),
      shippingTotal: toNumber(order.shippingTotal),
      discountTotal: toNumber(order.discountTotal),
      items: order.items.map((i) => ({ productName: i.productName, variantName: i.variantName, quantity: i.quantity, lineTotal: toNumber(i.lineTotal) })),
      orderUrl: this.orderUrl(order),
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      bankTransfer,
    };
  }

  /** Fire-and-forget customer + admin notifications for a status the customer cares about. */
  async notify(orderId: string, event: 'received' | 'paid' | 'shipped' | 'cancelled') {
    try {
      const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
      const data = await this.mailData(order);
      const locale = mailLocale(order.locale);
      const isEn = locale === 'en';

      // Bank transfers announce the order at creation ('received') and only confirm payment later.
      const bankTransferPaid = event === 'paid' && order.paymentProvider === PaymentProvider.BANK_TRANSFER;
      if (bankTransferPaid) {
        await this.mail.send(order.email, templates.paymentConfirmed(locale, data));
      } else if (event === 'received' || event === 'paid') {
        await this.mail.send(order.email, templates.orderReceived(locale, data));
        const adminUrl = `${this.config.get('ADMIN_URL', { infer: true })}/orders/${order.id}`;
        await this.mail.sendToAdmin(templates.adminNewOrder({ ...data, orderUrl: adminUrl }, order.paymentProvider));
      }
      if (event === 'shipped') {
        await this.mail.send(order.email, templates.orderShipped(locale, data));
        if (order.userId) {
          await this.push.sendToUsers([order.userId], {
            title: isEn ? 'Your order is on its way' : 'Siparişin yola çıktı',
            body: `${order.orderNumber}${order.carrier ? ` · ${order.carrier}` : ''}`,
            data: { type: 'order', orderNumber: order.orderNumber },
          });
        }
      }
      if (event === 'cancelled') await this.mail.send(order.email, templates.orderCancelled(locale, data));
    } catch (e) {
      this.logger.error(`notify(${orderId}, ${event}) failed: ${(e as Error).message}`);
    }
  }
}
