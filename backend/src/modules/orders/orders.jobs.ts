import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentProvider } from '@prisma/client';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutService } from './checkout.service';
import { OrderLifecycleService } from './order-lifecycle.service';
import { Tracked } from '../cron/tracked.decorator';

/**
 * Runs inside the API process (pm2 fork mode, single instance) — no Redis/queue needed.
 * If the API is ever scaled to several instances, move these behind a lock.
 */
@Injectable()
export class OrdersJobs {
  private readonly logger = new Logger(OrdersJobs.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly checkout: CheckoutService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Cancels unpaid orders and returns their reserved stock. Card orders are only cancelled once the
   * provider has confirmed nothing was paid (ARC-05); a payment page opened recently keeps its order.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  @Tracked('orders.expire', { label: 'Ödenmeyen siparişleri kapatma', everyMin: 5 })
  async expireUnpaidOrders() {
    if (this.running) return;
    this.running = true;
    try {
      const cardCutoff = new Date(Date.now() - this.config.get('ORDER_PAYMENT_TIMEOUT_MINUTES', { infer: true }) * 60_000);
      const bankCutoff = new Date(Date.now() - this.config.get('BANK_TRANSFER_TIMEOUT_HOURS', { infer: true }) * 3600_000);
      const stale = await this.prisma.order.findMany({
        where: {
          status: 'PENDING_PAYMENT',
          OR: [
            {
              paymentProvider: { in: [PaymentProvider.STRIPE, PaymentProvider.IYZICO] },
              createdAt: { lt: cardCutoff },
              payments: { none: { createdAt: { gte: cardCutoff } } },
            },
            { paymentProvider: PaymentProvider.BANK_TRANSFER, createdAt: { lt: bankCutoff } },
          ],
        },
        select: { id: true, status: true, orderNumber: true, paymentProvider: true },
        orderBy: { createdAt: 'asc' },
        take: 200,
      });
      const down = new Set<PaymentProvider>();
      let expired = 0;
      for (const order of stale) {
        if (down.has(order.paymentProvider)) continue;
        try {
          if (order.paymentProvider !== PaymentProvider.BANK_TRANSFER && !(await this.checkout.readyToExpire(order.id))) continue;
          await this.prisma.$transaction(async (tx) => {
            await this.lifecycle.transition(tx, order, 'CANCELLED', { note: 'Ödeme süresi doldu (otomatik)' });
            await this.lifecycle.releaseStock(tx, order.id);
          });
          expired++;
          if (order.paymentProvider === PaymentProvider.BANK_TRANSFER) void this.lifecycle.notify(order.id, 'cancelled');
        } catch (e) {
          // Provider didn't answer: never cancel blind, try its orders again next round.
          if (e instanceof ServiceUnavailableException) down.add(order.paymentProvider);
          this.logger.warn(`could not expire ${order.orderNumber}: ${(e as Error).message}`);
        }
      }
      if (expired) this.logger.log(`expired ${expired} unpaid order(s)`);
      return { checked: stale.length, expired, providerDown: down.size };
    } finally {
      this.running = false;
    }
  }

  /** Housekeeping: abandoned guest carts, dead refresh tokens and used auth links. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  @Tracked('orders.cleanup', { label: 'Eski sepet, oturum ve bağlantı temizliği', everyMin: 1440 })
  async cleanup() {
    const now = Date.now();
    const [carts, tokens, links] = await Promise.all([
      this.prisma.cart.deleteMany({ where: { userId: null, updatedAt: { lt: new Date(now - 30 * 86400_000) } } }),
      this.prisma.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now) } }, { revokedAt: { lt: new Date(now - 7 * 86400_000) } }] } }),
      this.prisma.authToken.deleteMany({ where: { expiresAt: { lt: new Date(now - 86400_000) } } }),
    ]);
    this.logger.log(`cleanup: ${carts.count} carts, ${tokens.count} refresh tokens, ${links.count} auth links`);
    return { carts: carts.count, refreshTokens: tokens.count, authLinks: links.count };
  }
}
