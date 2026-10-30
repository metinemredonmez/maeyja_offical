import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { OrderWithItems } from './order-lifecycle.service';

type Attribution = { fbp?: string; fbc?: string; gaClientId?: string; userAgent?: string; purchaseSentAt?: string };

const sha256 = (value: string) => createHash('sha256').update(value.trim().toLowerCase()).digest('hex');

/**
 * The server half of the ad pixels: when an order is paid, one Purchase goes to Meta (Conversions API) and one
 * to GA4 (Measurement Protocol), with the order number as event id so the browser's own Purchase is not counted
 * twice. Only for visitors who accepted cookies (their attribution was saved at checkout), once per order.
 */
@Injectable()
export class PurchaseTrackingService {
  private readonly logger = new Logger(PurchaseTrackingService.name);
  private readonly site: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    config: ConfigService<Env, true>,
  ) {
    this.site = config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
  }

  async purchase(order: OrderWithItems) {
    const attribution = (order.attribution ?? null) as Attribution | null;
    if (!attribution || attribution.purchaseSentAt) return;
    const cfg = await this.settings.get('tracking');
    const sends: Promise<void>[] = [];
    if (cfg.metaPixelId && cfg.metaCapiToken) sends.push(this.meta(order, attribution, cfg.metaPixelId, cfg.metaCapiToken, cfg.metaTestCode));
    if (cfg.ga4Id && cfg.ga4ApiSecret && attribution.gaClientId) sends.push(this.ga4(order, attribution.gaClientId, cfg.ga4Id, cfg.ga4ApiSecret));
    if (!sends.length) return;
    const results = await Promise.allSettled(sends);
    for (const r of results) if (r.status === 'rejected') this.logger.warn(`Satın alma olayı gönderilemedi (${order.orderNumber}): ${String(r.reason)}`);
    await this.prisma.order.update({
      where: { id: order.id },
      data: { attribution: { ...attribution, purchaseSentAt: new Date().toISOString() } as Prisma.InputJsonValue },
    });
  }

  private async meta(order: OrderWithItems, a: Attribution, pixelId: string, token: string, testCode: string) {
    const phone = (order.phone ?? '').replace(/\D/g, '');
    const body = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor((order.paidAt ?? new Date()).getTime() / 1000),
          event_id: order.orderNumber,
          action_source: 'website',
          event_source_url: `${this.site}/checkout/result`,
          user_data: {
            em: [sha256(order.email)],
            ...(phone ? { ph: [sha256(phone)] } : {}),
            ...(order.userId ? { external_id: [sha256(order.userId)] } : {}),
            ...(order.ip ? { client_ip_address: order.ip } : {}),
            ...(a.userAgent ? { client_user_agent: a.userAgent } : {}),
            ...(a.fbp ? { fbp: a.fbp } : {}),
            ...(a.fbc ? { fbc: a.fbc } : {}),
          },
          custom_data: {
            currency: 'TRY',
            value: Number(order.total),
            order_id: order.orderNumber,
            content_type: 'product',
            content_ids: order.items.map((i) => i.sku),
            contents: order.items.map((i) => ({ id: i.sku, quantity: i.quantity, item_price: Number(i.unitPrice) })),
            num_items: order.items.reduce((n, i) => n + i.quantity, 0),
          },
        },
      ],
      ...(testCode ? { test_event_code: testCode } : {}),
    };
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Meta ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  private async ga4(order: OrderWithItems, clientId: string, measurementId: string, apiSecret: string) {
    const body = {
      client_id: clientId,
      ...(order.userId ? { user_id: order.userId } : {}),
      events: [
        {
          name: 'purchase',
          params: {
            transaction_id: order.orderNumber,
            currency: 'TRY',
            value: Number(order.total),
            shipping: Number(order.shippingTotal),
            tax: Number(order.taxTotal),
            ...(order.couponCode ? { coupon: order.couponCode } : {}),
            items: order.items.map((i) => ({ item_id: i.sku, item_name: i.productName, item_variant: i.variantName ?? undefined, price: Number(i.unitPrice), quantity: i.quantity })),
          },
        },
      ],
    };
    const res = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`GA4 ${res.status}`);
  }
}
