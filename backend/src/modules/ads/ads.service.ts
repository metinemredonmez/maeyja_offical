import { Injectable } from '@nestjs/common';
import { toNumber } from '../../common/utils/money.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PAID_STATUSES } from '../orders/order-lifecycle.service';
import { MetaAdsClient } from './meta-ads.client';

export const RANGES = { '7d': { preset: 'last_7d', days: 7 }, '30d': { preset: 'last_30d', days: 30 }, '90d': { preset: 'last_90d', days: 90 } } as const;
export type Range = keyof typeof RANGES;
const CACHE_MS = 10 * 60_000;

type Action = { action_type: string; value: string };
type Insight = { campaign_id?: string; spend?: string; impressions?: string; clicks?: string; actions?: Action[]; action_values?: Action[] };
type Campaign = { id: string; name: string; status: string; effective_status: string; objective?: string; daily_budget?: string; lifetime_budget?: string; start_time?: string; stop_time?: string };
type Account = { name?: string; currency?: string; account_status?: number; amount_spent?: string; spend_cap?: string };

/** Meta names a purchase differently depending on where it was measured; the first one present counts. */
const PURCHASE = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];
export const purchaseOf = (list: Action[] | undefined) => {
  for (const type of PURCHASE) {
    const hit = list?.find((a) => a.action_type === type);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
};
/** Budgets, spend caps and amounts spent come in the currency's cents; insights' spend in whole units. */
export const fromMinor = (v: string | undefined) => (v ? Number(v) / 100 : null);
const num = (v: string | undefined) => Number(v ?? 0) || 0;

/**
 * Admin → Reklamlar: what Meta says (campaigns, spend, its own purchase count) next to what the shop saw — paid
 * orders from visitors who came through a Meta ad (the `_fbc` click cookie, kept only with cookie consent). ROAS is
 * the shop's own revenue over the spend. Cached for ten minutes, so the page doesn't eat Meta's rate limit.
 */
@Injectable()
export class AdsService {
  private readonly cache = new Map<Range, { at: number; data: unknown }>();

  constructor(
    private readonly meta: MetaAdsClient,
    private readonly prisma: PrismaService,
  ) {}

  async overview(range: Range, fresh = false) {
    const hit = this.cache.get(range);
    if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data;
    const status = await this.meta.status();
    if (!status.connected) return { connected: false };

    const { preset, days } = RANGES[range];
    const id = status.accountId;
    const [account, campaigns, perCampaign, total, shop] = await Promise.all([
      this.meta.get<Account>(`/${id}`, { fields: 'name,currency,account_status,amount_spent,spend_cap' }),
      this.meta.get<{ data: Campaign[] }>(`/${id}/campaigns`, { fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time', limit: '100' }),
      this.meta.get<{ data: Insight[] }>(`/${id}/insights`, { level: 'campaign', fields: 'campaign_id,spend,impressions,clicks,actions,action_values', date_preset: preset, limit: '200' }),
      this.meta.get<{ data: Insight[] }>(`/${id}/insights`, { fields: 'spend,impressions,clicks,actions,action_values', date_preset: preset }),
      this.shopOrders(days),
    ]);
    const t = total.data?.[0] ?? {};
    const spend = num(t.spend);
    const byCampaign = new Map((perCampaign.data ?? []).map((i) => [i.campaign_id, i]));
    const data = {
      connected: true,
      range,
      account: {
        id,
        name: account.name ?? status.accountName,
        currency: account.currency ?? status.currency,
        active: account.account_status === 1,
        amountSpent: fromMinor(account.amount_spent),
        spendCap: fromMinor(account.spend_cap) || null,
      },
      totals: {
        spend,
        impressions: num(t.impressions),
        clicks: num(t.clicks),
        metaPurchases: purchaseOf(t.actions),
        metaPurchaseValue: purchaseOf(t.action_values),
        shopOrders: shop.orders,
        shopRevenue: shop.revenue,
        roas: spend > 0 ? Math.round((shop.revenue / spend) * 100) / 100 : null,
      },
      campaigns: (campaigns.data ?? []).map((c) => {
        const i = byCampaign.get(c.id) ?? {};
        return {
          id: c.id,
          name: c.name,
          status: c.effective_status ?? c.status,
          objective: c.objective ?? null,
          dailyBudget: fromMinor(c.daily_budget),
          lifetimeBudget: fromMinor(c.lifetime_budget),
          startTime: c.start_time ?? null,
          stopTime: c.stop_time ?? null,
          spend: num(i.spend),
          impressions: num(i.impressions),
          clicks: num(i.clicks),
          purchases: purchaseOf(i.actions),
          purchaseValue: purchaseOf(i.action_values),
        };
      }),
      fetchedAt: new Date().toISOString(),
    };
    this.cache.set(range, { at: Date.now(), data });
    return data;
  }

  clearCache() {
    this.cache.clear();
  }

  /** Paid orders whose buyer had clicked a Meta ad (`_fbc` = "fb.1.<time>.<click id>"). */
  private async shopOrders(days: number) {
    const where = { status: { in: PAID_STATUSES }, paidAt: { gte: new Date(Date.now() - days * 86400_000) }, attribution: { path: ['fbc'], string_starts_with: 'fb.' } };
    const [orders, sum] = await Promise.all([this.prisma.order.count({ where }), this.prisma.order.aggregate({ where, _sum: { total: true } })]);
    return { orders, revenue: toNumber(sum._sum.total ?? 0) };
  }
}
