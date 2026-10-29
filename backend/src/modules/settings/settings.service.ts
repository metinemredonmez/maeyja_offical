import { BadRequestException, Injectable } from '@nestjs/common';
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
    return Object.fromEntries(SETTING_KEYS.map((k) => [k, { ...SETTING_DEFAULTS[k], ...(byKey.get(k) ?? {}) }]));
  }

  async update(key: string, patch: Record<string, unknown>) {
    if (!SETTING_KEYS.includes(key as SettingKey)) throw new BadRequestException(`Bilinmeyen ayar: ${key}`);
    const current = await this.get(key as SettingKey);
    // Only accept keys that exist in the defaults; ignore anything else.
    const allowed = Object.fromEntries(Object.entries(patch).filter(([k]) => k in SETTING_DEFAULTS[key as SettingKey]));
    const value = { ...current, ...allowed } as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    return value;
  }

  /** What the storefront and mobile app may see. */
  async getPublic() {
    const [store, shipping, bankTransfer, checkout, assistant] = await Promise.all([
      this.get('store'),
      this.get('shipping'),
      this.get('bankTransfer'),
      this.get('checkout'),
      this.get('assistant'),
    ]);
    return {
      store,
      shipping: {
        flatRate: shipping.flatRate,
        freeShippingThreshold: shipping.freeShippingThreshold,
        estimatedDays: shipping.estimatedDays,
      },
      checkout,
      assistant: { enabled: assistant.enabled, welcome: assistant.welcome },
      bankTransfer: bankTransfer.enabled
        ? bankTransfer
        : { enabled: false },
    };
  }
}
