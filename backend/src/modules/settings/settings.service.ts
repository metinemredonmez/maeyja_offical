import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { templates } from '../notifications/mail.templates';
import { SETTING_DEFAULTS, SETTING_KEYS, SettingKey, SettingValue } from './settings.defaults';
import { cleanSettingPatch, maskSecrets } from './settings.validate';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return { ...SETTING_DEFAULTS[key], ...((row?.value as object) ?? {}) } as SettingValue<K>;
  }

  /** For the admin: like getAll, but secrets only as their last four characters. */
  async getAllForAdmin() {
    const all = await this.getAll();
    return Object.fromEntries(Object.entries(all).map(([k, v]) => [k, maskSecrets(k as SettingKey, v as Record<string, unknown>)])) as typeof all;
  }

  async getAll() {
    const rows = await this.prisma.setting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r.value as object]));
    const all = Object.fromEntries(SETTING_KEYS.map((k) => [k, { ...SETTING_DEFAULTS[k], ...(byKey.get(k) ?? {}) }])) as { [K in SettingKey]: SettingValue<K> };
    // The admin's home page preview needs the staff token even while the shop is open: made the first time it is read.
    if (!all.maintenance.previewToken) all.maintenance = (await this.update('maintenance', {})) as unknown as SettingValue<'maintenance'>;
    return all;
  }

  async update(key: string, patch: Record<string, unknown>, actor?: { email?: string }) {
    if (!SETTING_KEYS.includes(key as SettingKey)) throw new BadRequestException(`Bilinmeyen ayar: ${key}`);
    const current = await this.get(key as SettingKey);
    // INP-01: known fields only, each with its default's type and range; masked secrets stay as they are.
    const allowed = cleanSettingPatch(key as SettingKey, patch ?? {});
    const merged = { ...current, ...allowed } as Record<string, unknown>;
    // The account customers are told to pay into: any change is announced to the shop (payment redirection).
    const before = current as Record<string, unknown>;
    if (key === 'bankTransfer' && (merged.iban !== before.iban || merged.accountName !== before.accountName)) {
      this.logger.warn(`bank account for transfers changed by ${actor?.email ?? 'unknown'}`);
      void this.mail.sendToAdmin(
        templates.securityNotice('Havale hesabı değişti', [
          `Müşterilere gösterilen havale hesabı değiştirildi: ${String(merged.accountName ?? '')} · ${String(merged.iban ?? '')}`,
          `Değiştiren: ${actor?.email ?? 'bilinmiyor'}`,
        ]),
      );
    }
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
