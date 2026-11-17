import { BadRequestException, Logger } from '@nestjs/common';
import { AdsService, fromMinor, purchaseOf } from './ads.service';
import { MetaAdsClient } from './meta-ads.client';

Logger.overrideLogger(false);

const TOKEN = 'EAAB' + 'x'.repeat(60) + 'Z9Q1';

function client() {
  let row: { value: unknown } | null = null;
  const prisma = {
    setting: {
      findUnique: jest.fn(async () => row),
      upsert: jest.fn(async (q: { create: { value: unknown } }) => (row = { value: q.create.value })),
      deleteMany: jest.fn(async () => (row = null)),
    },
  };
  const alerts = { raise: jest.fn(async () => undefined), clear: jest.fn(async () => undefined) };
  const env: Record<string, string> = { APP_ENCRYPTION_KEY: '', JWT_ACCESS_SECRET: 'y'.repeat(32) };
  const meta = new MetaAdsClient(prisma as never, alerts as never, { get: (k: string) => env[k] } as never);
  return { meta, prisma, alerts, stored: () => row?.value as Record<string, string> | undefined };
}

const reply = (body: object, ok = true) => jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok, status: ok ? 200 : 400, json: async () => body } as Response);

afterEach(() => jest.restoreAllMocks());

describe('Meta insights', () => {
  it('counts purchases the way Meta reports them and turns cents into units', () => {
    expect(purchaseOf([{ action_type: 'link_click', value: '40' }, { action_type: 'purchase', value: '3' }])).toBe(3);
    expect(purchaseOf([{ action_type: 'omni_purchase', value: '4' }, { action_type: 'purchase', value: '3' }])).toBe(4);
    expect(purchaseOf(undefined)).toBe(0);
    expect(fromMinor('250000')).toBe(2500);
    expect(fromMinor(undefined)).toBeNull();
  });
});

describe('MetaAdsClient (KEY-01, EXT-01)', () => {
  it('refuses a malformed token or account before calling Meta', async () => {
    const { meta } = client();
    const fetch = jest.spyOn(globalThis, 'fetch');
    await expect(meta.connect('not a token', '123456789')).rejects.toThrow(/token/i);
    await expect(meta.connect(TOKEN, 'act_abc')).rejects.toThrow(/rakam/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('checks the account with Meta, then keeps the token encrypted and shows only its ends', async () => {
    const { meta, stored } = client();
    const fetch = reply({ name: 'MAEYJA', currency: 'TRY', account_status: 1 });
    await expect(meta.connect(TOKEN, '1234567890')).resolves.toMatchObject({ connected: true, accountId: 'act_1234567890', accountName: 'MAEYJA', currency: 'TRY', tokenHint: 'EAAB…Z9Q1' });
    expect(String(fetch.mock.calls[0][0])).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/act_1234567890\?/);
    expect(fetch.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
    expect(JSON.stringify(stored())).not.toContain(TOKEN);
  });

  it('never repeats the token in an error', async () => {
    const { meta } = client();
    reply({ error: { code: 190, message: `Invalid OAuth access token ${TOKEN}` } }, false);
    const err = await meta.connect(TOKEN, '1234567890').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as Error).message).toMatch(/geçersiz/);
    expect((err as Error).message).not.toContain(TOKEN);
  });
});

describe('AdsService.overview', () => {
  it('sets the shop’s own revenue from Meta-clicked orders against the spend', async () => {
    const meta = {
      status: jest.fn(async () => ({ connected: true, accountId: 'act_1', accountName: 'MAEYJA', currency: 'TRY' })),
      get: jest.fn(async (path: string, params: Record<string, string>) => {
        if (path === '/act_1') return { name: 'MAEYJA', currency: 'TRY', account_status: 1, amount_spent: '1000000', spend_cap: '0' };
        if (path.endsWith('/campaigns')) return { data: [{ id: 'c1', name: 'Petal Box', status: 'ACTIVE', effective_status: 'ACTIVE', daily_budget: '50000' }] };
        if (params.level === 'campaign') return { data: [{ campaign_id: 'c1', spend: '1500.50', clicks: '300', actions: [{ action_type: 'purchase', value: '2' }] }] };
        return { data: [{ spend: '2000', impressions: '50000', clicks: '400', actions: [{ action_type: 'purchase', value: '3' }], action_values: [{ action_type: 'purchase', value: '30000' }] }] };
      }),
    };
    const prisma = { order: { count: jest.fn(async () => 4), aggregate: jest.fn(async () => ({ _sum: { total: 36000 } })) } };
    const svc = new AdsService(meta as never, prisma as never);
    const out = (await svc.overview('30d')) as { totals: Record<string, number>; campaigns: Record<string, unknown>[]; account: Record<string, unknown> };
    expect(out.totals).toMatchObject({ spend: 2000, metaPurchases: 3, metaPurchaseValue: 30000, shopOrders: 4, shopRevenue: 36000, roas: 18 });
    expect(out.campaigns[0]).toMatchObject({ name: 'Petal Box', dailyBudget: 500, spend: 1500.5, purchases: 2 });
    expect(out.account).toMatchObject({ amountSpent: 10000, spendCap: null, active: true });
    expect(prisma.order.count).toHaveBeenCalledWith({ where: expect.objectContaining({ attribution: { path: ['fbc'], string_starts_with: 'fb.' } }) });
    // A second look within ten minutes asks Meta nothing.
    await svc.overview('30d');
    expect(meta.get).toHaveBeenCalledTimes(4);
  });
});
