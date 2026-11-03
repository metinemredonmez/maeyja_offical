import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SETTING_DEFAULTS, SETTING_KEYS, SettingKey, SettingValue } from './settings.defaults';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return { ...SETTING_DEFAULTS[key], ...((row?.value as object) ?? {}) } as SettingValue<K>;
  }

  async getAll() {
    const rows = await this.prisma.setting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r.value as object]));
    const all = Object.fromEntries(SETTING_KEYS.map((k) => [k, { ...SETTING_DEFAULTS[k], ...(byKey.get(k) ?? {}) }])) as { [K in SettingKey]: SettingValue<K> };
    // The admin's home page preview needs the staff token even while the shop is open: made the first time it is read.
    if (!all.maintenance.previewToken) all.maintenance = (await this.update('maintenance', {})) as unknown as SettingValue<'maintenance'>;
    return all;
  }

  async update(key: string, patch: Record<string, unknown>) {
    if (!SETTING_KEYS.includes(key as SettingKey)) throw new BadRequestException(`Bilinmeyen ayar: ${key}`);
    const current = await this.get(key as SettingKey);
    // Only accept keys that exist in the defaults; ignore anything else.
    const allowed = Object.fromEntries(Object.entries(patch).filter(([k]) => k in SETTING_DEFAULTS[key as SettingKey]));
    const merged = { ...current, ...allowed } as Record<string, unknown>;
    if (key === 'maintenance' && !merged.previewToken) merged.previewToken = randomBytes(16).toString('hex');
    const value = merged as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    return value;
  }

  /**
   * Whether the storefront is closed for maintenance, and whether this visitor carries the staff preview token: it lets
   * them in while closed, and (open or closed) shows the admin's home page preview without the minute-long cache.
   */
  async maintenance(preview?: string) {
    const [{ enabled, previewToken }, store] = await Promise.all([this.get('maintenance'), this.get('store')]);
    const a = Buffer.from(preview ?? ''), b = Buffer.from(previewToken);
    return {
      enabled,
      preview: b.length > 0 && a.length === b.length && timingSafeEqual(a, b),
      // Shown on the maintenance page so customers can still reach the shop.
      contact: { email: store.email, phone: store.phone, instagram: store.instagram },
    };
  }

  /** What the storefront and mobile app may see. */
  async getPublic() {
    const [store, shipping, bankTransfer, checkout, assistant, tryon, tracking, productPage] = await Promise.all([
      this.get('store'),
      this.get('shipping'),
      this.get('bankTransfer'),
      this.get('checkout'),
      this.get('assistant'),
      this.get('tryon'),
      this.get('tracking'),
      this.get('productPage'),
    ]);
    // Only plain hex colours reach the page's style attribute.
    const hex = (v: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
    return {
      store,
      productPage: { ground: hex(productPage.ground, '#f5f1ea'), tile: hex(productPage.tile, '#e9e3d8') },
      shipping: {
        flatRate: shipping.flatRate,
        freeShippingThreshold: shipping.freeShippingThreshold,
        estimatedDays: shipping.estimatedDays,
      },
      checkout,
      assistant: { enabled: assistant.enabled, welcome: assistant.welcome },
      tryon: { enabled: tryon.enabled },
      // Only the public IDs; the server-side token and API secret never leave the API.
      tracking: {
        // A wrong paste (an e-mail, an HTML tag) never reaches the storefront's scripts or <head>.
        metaPixelId: /^\d{10,20}$/.test(tracking.metaPixelId) ? tracking.metaPixelId : '',
        ga4Id: /^G-[A-Z0-9]{4,}$/.test(tracking.ga4Id) ? tracking.ga4Id : '',
        googleAdsId: /^AW-\d{6,}$/.test(tracking.googleAdsId) ? tracking.googleAdsId : '',
        googleAdsPurchaseLabel: /^[\w-]{6,}$/.test(tracking.googleAdsPurchaseLabel) ? tracking.googleAdsPurchaseLabel : '',
        googleSiteVerification: /^[\w-]{20,}$/.test(tracking.googleSiteVerification) ? tracking.googleSiteVerification : '',
        allowAiCrawlers: tracking.allowAiCrawlers,
      },
      bankTransfer: bankTransfer.enabled
        ? bankTransfer
        : { enabled: false },
    };
  }
}
