import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentProvider } from '@prisma/client';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderLifecycleService } from './order-lifecycle.service';

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
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Cancels unpaid orders and returns their reserved stock. */
  @Cron(CronExpression.EVERY_5_MINUTES)
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
            { paymentProvider: PaymentProvider.IYZICO, createdAt: { lt: cardCutoff } },
            { paymentProvider: PaymentProvider.BANK_TRANSFER, createdAt: { lt: bankCutoff } },
          ],
        },
        select: { id: true, status: true, orderNumber: true, paymentProvider: true },
        take: 200,
      });
      for (const order of stale) {
        try {
          await this.prisma.$transaction(async (tx) => {
            await this.lifecycle.transition(tx, order, 'CANCELLED', { note: 'Ödeme süresi doldu (otomatik)' });
            await this.lifecycle.releaseStock(tx, order.id);
          });
          if (order.paymentProvider === PaymentProvider.BANK_TRANSFER) void this.lifecycle.notify(order.id, 'cancelled');
        } catch (e) {
          this.logger.warn(`could not expire ${order.orderNumber}: ${(e as Error).message}`);
        }
      }
      if (stale.length) this.logger.log(`expired ${stale.length} unpaid order(s)`);
    } finally {
      this.running = false;
    }
  }

  /** Housekeeping: abandoned guest carts, dead refresh tokens and used auth links. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanup() {
    const now = Date.now();
    const [carts, tokens, links] = await Promise.all([
      this.prisma.cart.deleteMany({ where: { userId: null, updatedAt: { lt: new Date(now - 30 * 86400_000) } } }),
      this.prisma.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now) } }, { revokedAt: { lt: new Date(now - 7 * 86400_000) } }] } }),
      this.prisma.authToken.deleteMany({ where: { expiresAt: { lt: new Date(now - 86400_000) } } }),
    ]);
    this.logger.log(`cleanup: ${carts.count} carts, ${tokens.count} refresh tokens, ${links.count} auth links`);
  }
}
