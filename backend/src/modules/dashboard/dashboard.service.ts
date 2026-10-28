import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toNumber } from '../../common/utils/money.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PAID_STATUSES } from '../orders/order-lifecycle.service';

const LOW_STOCK = 3;
const DAY = 86400_000;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d7 = new Date(startOfToday.getTime() - 6 * DAY);
    const d30 = new Date(startOfToday.getTime() - 29 * DAY);
    const prev30 = new Date(d30.getTime() - 30 * DAY);
    const paid: Prisma.OrderWhereInput = { status: { in: PAID_STATUSES } };

    const [today, week, month, prevMonth, statusCounts, recentOrders, lowStock, newCustomers, pendingReturns, unreadMessages, subscribers, series, topItems] =
      await Promise.all([
        this.revenue({ ...paid, paidAt: { gte: startOfToday } }),
        this.revenue({ ...paid, paidAt: { gte: d7 } }),
        this.revenue({ ...paid, paidAt: { gte: d30 } }),
        this.revenue({ ...paid, paidAt: { gte: prev30, lt: d30 } }),
        this.prisma.order.groupBy({ by: ['status'], _count: true }),
        this.prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { id: true, orderNumber: true, status: true, total: true, email: true, createdAt: true, paymentProvider: true },
        }),
        this.prisma.productVariant.findMany({
          where: { deletedAt: null, isActive: true, stock: { lte: LOW_STOCK }, product: { deletedAt: null, status: 'ACTIVE' } },
          orderBy: { stock: 'asc' },
          take: 10,
          include: { product: { select: { id: true, name: true } }, color: { select: { name: true, hex: true } }, _count: { select: { stockAlerts: { where: { notifiedAt: null } } } } },
        }),
        this.prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: d30 }, deletedAt: null } }),
        this.prisma.returnRequest.count({ where: { status: 'REQUESTED' } }),
        this.prisma.contactMessage.count({ where: { isRead: false } }),
        this.prisma.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
        this.prisma.$queryRaw<{ day: Date; revenue: Prisma.Decimal; orders: bigint }[]>`
          SELECT date_trunc('day', "paidAt") AS day, SUM("total") AS revenue, COUNT(*) AS orders
          FROM "Order"
          WHERE "paidAt" >= ${d30} AND "status"::text = ANY(${PAID_STATUSES as string[]})
          GROUP BY 1 ORDER BY 1`,
        this.prisma.orderItem.groupBy({
          by: ['productId', 'productName'],
          where: { order: { ...paid, paidAt: { gte: d30 } } },
          _sum: { quantity: true, lineTotal: true },
          orderBy: { _sum: { lineTotal: 'desc' } },
          take: 5,
        }),
      ]);

    // Fill missing days so the chart has a continuous 30-day axis.
    const byDay = new Map(series.map((r) => [r.day.toISOString().slice(0, 10), r]));
    const daily = Array.from({ length: 30 }, (_, i) => {
      const day = new Date(d30.getTime() + i * DAY);
      const key = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())).toISOString().slice(0, 10);
      const row = byDay.get(key);
      return { date: key, revenue: row ? toNumber(row.revenue) : 0, orders: row ? Number(row.orders) : 0 };
    });

    return {
      revenue: {
        today,
        last7Days: week,
        last30Days: month,
        previous30Days: prevMonth,
        changePct: prevMonth.total > 0 ? Math.round(((month.total - prevMonth.total) / prevMonth.total) * 1000) / 10 : null,
      },
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
      toShip: statusCounts.filter((s) => s.status === 'PAID' || s.status === 'PROCESSING').reduce((n, s) => n + s._count, 0),
      daily,
      topProducts: topItems.map((t) => ({ productId: t.productId, name: t.productName, quantity: t._sum.quantity ?? 0, revenue: toNumber(t._sum.lineTotal) })),
      lowStock: lowStock.map((v) => ({
        variantId: v.id,
        productId: v.product.id,
        productName: v.product.name,
        sku: v.sku,
        color: v.color,
        size: v.size,
        stock: v.stock,
        waitingAlerts: v._count.stockAlerts,
      })),
      recentOrders,
      newCustomers30d: newCustomers,
      pendingReturns,
      unreadMessages,
      subscribers,
    };
  }

  private async revenue(where: Prisma.OrderWhereInput) {
    const agg = await this.prisma.order.aggregate({ where, _sum: { total: true }, _count: true });
    const total = toNumber(agg._sum.total);
    return { total, orders: agg._count, averageOrderValue: agg._count ? Math.round((total / agg._count) * 100) / 100 : 0 };
  }
}
