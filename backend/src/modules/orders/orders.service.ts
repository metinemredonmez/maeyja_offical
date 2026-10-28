import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentProvider, PaymentStatus, Prisma, ReturnStatus } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { paginate, PaginationQueryDto, skipTake } from '../../common/dto/pagination.dto';
import { toNumber } from '../../common/utils/money.util';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { mailLocale, templates } from '../notifications/mail.templates';
import { SettingsService } from '../settings/settings.service';
import {
  AdminOrderQueryDto,
  AdminReturnQueryDto,
  ReturnRequestDto,
  ShipOrderDto,
  UpdateOrderStatusDto,
  UpdateReturnDto,
} from './dto/orders.dto';
import { IyzicoClient } from './iyzico.client';
import { OrderLifecycleService, TRANSITIONS } from './order-lifecycle.service';

const RETURN_WINDOW_DAYS = 14; // cayma hakkı (Mesafeli Sözleşmeler Yönetmeliği)

const customerOrderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  email: true,
  currency: true,
  subtotal: true,
  discountTotal: true,
  shippingTotal: true,
  taxTotal: true,
  total: true,
  couponCode: true,
  paymentProvider: true,
  shippingAddress: true,
  billingAddress: true,
  customerNote: true,
  carrier: true,
  trackingNumber: true,
  trackingUrl: true,
  paidAt: true,
  shippedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  createdAt: true,
  items: { select: { id: true, productId: true, productName: true, variantName: true, sku: true, colorName: true, size: true, imageUrl: true, unitPrice: true, quantity: true, lineTotal: true } },
  history: { select: { to: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
  returnRequests: { select: { id: true, status: true, reason: true, createdAt: true } },
} satisfies Prisma.OrderSelect;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly settings: SettingsService,
    private readonly iyzico: IyzicoClient,
    private readonly mail: MailService,
  ) {}

  // ─────────────────────────── customer ───────────────────────────

  async myOrders(userId: string, q: PaginationQueryDto) {
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
        select: { id: true, orderNumber: true, status: true, total: true, createdAt: true, items: { select: { productName: true, variantName: true, imageUrl: true, quantity: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(items, total, q.page, q.limit);
  }

  async myOrder(userId: string, orderNumber: string) {
    const order = await this.prisma.order.findFirst({ where: { orderNumber, userId }, select: customerOrderSelect });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    return this.withPaymentInfo(order);
  }

  /** Guest order tracking: order number + the email used at checkout. */
  async lookup(orderNumber: string, email: string) {
    const order = await this.prisma.order.findFirst({ where: { orderNumber: orderNumber.trim().toUpperCase(), email }, select: customerOrderSelect });
    if (!order) throw new NotFoundException('Sipariş bulunamadı — numara ve e-postayı kontrol edin');
    return this.withPaymentInfo(order);
  }

  async requestReturn(orderNumber: string, user: AuthUser | undefined, dto: ReturnRequestDto) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber }, include: { items: true, returnRequests: true } });
    const owns = order && (user ? order.userId === user.id : dto.email && order.email === dto.email);
    if (!order || !owns) throw new NotFoundException('Sipariş bulunamadı');
    if (order.status !== 'DELIVERED' && order.status !== 'SHIPPED') throw new BadRequestException('İade talebi yalnızca teslim edilen siparişler için açılabilir');
    const since = order.deliveredAt ?? order.shippedAt ?? order.createdAt;
    if (Date.now() - since.getTime() > RETURN_WINDOW_DAYS * 86400_000) throw new BadRequestException(`İade süresi (${RETURN_WINDOW_DAYS} gün) dolmuş`);
    if (order.returnRequests.some((r) => r.status === 'REQUESTED' || r.status === 'APPROVED')) throw new BadRequestException('Bu sipariş için açık bir iade talebi var');
    for (const it of dto.items) {
      const line = order.items.find((i) => i.id === it.orderItemId);
      if (!line || it.quantity > line.quantity) throw new BadRequestException('İade edilecek ürünler geçersiz');
    }
    const created = await this.prisma.returnRequest.create({
      data: { orderId: order.id, userId: order.userId, email: order.email, reason: dto.reason, items: dto.items as unknown as Prisma.InputJsonValue },
    });
    void this.mail.sendToAdmin(templates.adminNotice(`İade talebi: ${order.orderNumber}`, { Sipariş: order.orderNumber, Müşteri: order.email, Sebep: dto.reason }));
    return created;
  }

  private async withPaymentInfo<T extends { paymentProvider: PaymentProvider; status: OrderStatus }>(order: T) {
    if (order.paymentProvider === PaymentProvider.BANK_TRANSFER && order.status === 'PENDING_PAYMENT') {
      const bt = await this.settings.get('bankTransfer');
      return { ...order, bankTransfer: { bankName: bt.bankName, accountName: bt.accountName, iban: bt.iban, note: bt.note } };
    }
    return order;
  }

  // ─────────────────────────── admin ───────────────────────────

  async adminList(q: AdminOrderQueryDto) {
    const where = this.adminWhere(q);
    const [rows, total, counts] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
        include: { _count: { select: { items: true } }, user: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['status'], _count: true }),
    ]);
    const items = rows.map((o) => {
      const ship = o.shippingAddress as { firstName?: string; lastName?: string; city?: string };
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        email: o.email,
        customerName: `${ship.firstName ?? ''} ${ship.lastName ?? ''}`.trim(),
        city: ship.city,
        total: o.total,
        paymentProvider: o.paymentProvider,
        itemCount: o._count.items,
        isGuest: !o.userId,
        createdAt: o.createdAt,
      };
    });
    return { ...paginate(items, total, q.page, q.limit), statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count])) };
  }

  async adminGet(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' }, omit: { raw: true } },
        history: { orderBy: { createdAt: 'asc' } },
        returnRequests: { orderBy: { createdAt: 'desc' } },
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true, _count: { select: { orders: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    const actorIds = [...new Set(order.history.map((h) => h.actorId).filter((x): x is string => Boolean(x)))];
    const actors = actorIds.length ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, firstName: true, email: true } }) : [];
    const { carriers } = await this.settings.get('shipping');
    return {
      ...order,
      history: order.history.map((h) => ({ ...h, actor: actors.find((a) => a.id === h.actorId) ?? null })),
      allowedTransitions: TRANSITIONS[order.status],
      carriers,
    };
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, actor: AuthUser, ip: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true, payments: true } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    this.lifecycle.assertTransition(order.status, dto.status);
    if (dto.status === 'SHIPPED') throw new BadRequestException('Kargoya vermek için kargo bilgisiyle /ship kullanın');

    // Optional provider-side cancel for card payments (works until the day's settlement).
    let providerNote = '';
    if ((dto.status === 'CANCELLED' || dto.status === 'REFUNDED') && dto.refundOnProvider && order.paymentProvider === 'IYZICO') {
      const paid = order.payments.find((p) => p.status === PaymentStatus.SUCCEEDED && p.providerPaymentId);
      if (paid) {
        const r = await this.iyzico.cancelPayment(paid.providerPaymentId!, ip, paid.id);
        if (r.status !== 'success') {
          throw new BadRequestException(`iyzico iptal edilemedi (${r.errorMessage}). Ödemeyi iyzico panelinden iade edip tekrar deneyin.`);
        }
        await this.prisma.payment.update({ where: { id: paid.id }, data: { status: PaymentStatus.REFUNDED } });
        providerNote = ' · iyzico ödemesi iptal edildi';
      }
    }

    const wasShipped = order.status === 'SHIPPED' || order.status === 'DELIVERED';
    await this.prisma.$transaction(async (tx) => {
      await this.lifecycle.transition(tx, order, dto.status, { note: `${dto.note ?? ''}${providerNote}`.trim() || undefined, actorId: actor.id });
      if (dto.status === 'CANCELLED' || (dto.status === 'REFUNDED' && (!wasShipped || dto.restock))) {
        await this.lifecycle.releaseStock(tx, order.id);
      }
      if (dto.status === 'PAID') {
        await tx.payment.updateMany({ where: { orderId: order.id, status: PaymentStatus.PENDING, provider: 'BANK_TRANSFER' }, data: { status: PaymentStatus.SUCCEEDED } });
      }
    });

    if (dto.notifyCustomer !== false) {
      if (dto.status === 'PAID') void this.lifecycle.notify(order.id, 'paid');
      if (dto.status === 'CANCELLED') void this.lifecycle.notify(order.id, 'cancelled');
    }
    return this.adminGet(id);
  }

  async ship(id: string, dto: ShipOrderDto, actor: AuthUser) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    const { carriers } = await this.settings.get('shipping');
    const trackingUrl = dto.trackingUrl ?? this.lifecycle.trackingUrl(carriers, dto.carrier, dto.trackingNumber);
    const carrierName = carriers.find((c) => c.code === dto.carrier)?.name ?? dto.carrier;

    await this.prisma.$transaction(async (tx) => {
      const data = { carrier: carrierName, trackingNumber: dto.trackingNumber, trackingUrl };
      if (order.status === 'SHIPPED') {
        await tx.order.update({ where: { id }, data }); // correcting tracking info
      } else {
        await this.lifecycle.transition(tx, order, 'SHIPPED', { note: `${carrierName} ${dto.trackingNumber}`, actorId: actor.id, data });
      }
    });
    if (dto.notifyCustomer !== false) void this.lifecycle.notify(id, 'shipped');
    return this.adminGet(id);
  }

  async setNote(id: string, adminNote: string) {
    await this.prisma.order.update({ where: { id }, data: { adminNote } });
    return this.adminGet(id);
  }

  /** CSV for accounting / e-invoice software. Semicolon-separated so Turkish Excel opens it directly. */
  async exportCsv(q: AdminOrderQueryDto) {
    const rows = await this.prisma.order.findMany({ where: this.adminWhere(q), orderBy: { createdAt: 'desc' }, take: 5000, include: { items: true } });
    const header = ['Sipariş No', 'Tarih', 'Durum', 'E-posta', 'Ad Soyad', 'Telefon', 'Şehir', 'Ürünler', 'Ara Toplam', 'İndirim', 'Kargo', 'KDV', 'Toplam', 'Ödeme', 'Kupon', 'Fatura Tipi', 'TCKN/VKN', 'Vergi Dairesi', 'Firma'];
    // Quote every cell and neutralise spreadsheet formula triggers (=, +, -, @, tab, CR).
    const cell = (v: unknown) => {
      const str = String(v ?? '').replace(/"/g, '""');
      return `"${/^[=+\-@\t\r]/.test(str) ? `'${str}` : str}"`;
    };
    const lines = rows.map((o) => {
      const s = o.shippingAddress as Record<string, string>;
      const b = o.billingAddress as Record<string, string>;
      return [
        o.orderNumber,
        o.createdAt.toISOString(),
        o.status,
        o.email,
        `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
        s.phone,
        s.city,
        o.items.map((i) => `${i.productName}${i.variantName ? ` (${i.variantName})` : ''} x${i.quantity}`).join(' | '),
        toNumber(o.subtotal).toFixed(2).replace('.', ','),
        toNumber(o.discountTotal).toFixed(2).replace('.', ','),
        toNumber(o.shippingTotal).toFixed(2).replace('.', ','),
        toNumber(o.taxTotal).toFixed(2).replace('.', ','),
        toNumber(o.total).toFixed(2).replace('.', ','),
        o.paymentProvider,
        o.couponCode,
        b.invoiceType,
        b.taxNumber ?? b.identityNumber,
        b.taxOffice,
        b.companyName,
      ]
        .map(cell)
        .join(';');
    });
    return '﻿' + [header.map(cell).join(';'), ...lines].join('\n');
  }

  private adminWhere(q: AdminOrderQueryDto): Prisma.OrderWhereInput {
    return {
      ...(q.status ? { status: q.status } : {}),
      ...(q.provider ? { paymentProvider: q.provider } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
      ...(q.q
        ? {
            OR: [
              { orderNumber: { contains: q.q, mode: 'insensitive' } },
              { email: { contains: q.q, mode: 'insensitive' } },
              { phone: { contains: q.q } },
              { trackingNumber: { contains: q.q } },
            ],
          }
        : {}),
    };
  }

  // ─────────────────────────── returns (admin) ───────────────────────────

  async adminReturns(q: AdminReturnQueryDto) {
    const where = q.status ? { status: q.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.returnRequest.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q), include: { order: { select: { id: true, orderNumber: true, total: true, items: true } } } }),
      this.prisma.returnRequest.count({ where }),
    ]);
    return paginate(items, total, q.page, q.limit);
  }

  async updateReturn(id: string, dto: UpdateReturnDto) {
    const rr = await this.prisma.returnRequest.findUnique({ where: { id }, include: { order: true } });
    if (!rr) throw new NotFoundException('İade talebi bulunamadı');
    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: { status: dto.status, adminNote: dto.adminNote, ...(dto.status === ReturnStatus.REFUNDED ? { refundedAt: new Date() } : {}) },
    });
    const labels: Record<ReturnStatus, [string, string]> = {
      REQUESTED: ['Alındı', 'Received'],
      APPROVED: ['Onaylandı — ürünü kargoya verebilirsiniz', 'Approved — please ship the item back'],
      REJECTED: ['Reddedildi', 'Rejected'],
      RECEIVED: ['Ürün bize ulaştı', 'Item received'],
      REFUNDED: ['İade ödemesi yapıldı', 'Refunded'],
    };
    const locale = mailLocale(rr.order.locale);
    void this.mail.send(rr.email, templates.returnUpdate(locale, rr.order.orderNumber, labels[dto.status][locale === 'en' ? 1 : 0]));
    return updated;
  }
}
