import { BadRequestException } from '@nestjs/common';
import { LOCALES } from '../../common/utils/i18n.util';
import { ALERT_CODES, webhookAllowed } from '../alerts/alert-catalog';
import { SETTING_DEFAULTS, SettingKey } from './settings.defaults';

/** Kept on the server; the admin sees only their last four characters (EXT-05). */
export const SECRET_FIELDS: Partial<Record<SettingKey, string[]>> = { tracking: ['metaCapiToken', 'ga4ApiSecret'], alerts: ['webhookUrl'] };
/** Written by the API itself, never by a PUT (INP-01): the preview token is made and rotated server-side. */
const SERVER_FIELDS: Partial<Record<SettingKey, string[]>> = { maintenance: ['previewToken'] };
export const MASK = '••••';

/** Numbers with a range; anything numeric that isn't listed must simply be ≥ 0. */
const RANGES: Record<string, [number, number]> = {
  'shipping.flatRate': [0, 100_000],
  'shipping.freeShippingThreshold': [0, 10_000_000],
  'tax.defaultRate': [0, 100],
  'checkout.maxQtyPerItem': [1, 50],
  'cartReminder.delayHours': [1, 168],
};
const LONG_TEXT = new Set(['assistant.instructions']);
const HEX = /^#[0-9a-f]{6}$/i;

const fail = (field: string, why: string): never => {
  throw new BadRequestException(`${field}: ${why}`);
};

/**
 * INP-01: a setting PUT only changes fields that exist, each with the type (and range) of its default.
 * Returns the cleaned patch; masked secrets mean "unchanged" and are dropped.
 */
export function cleanSettingPatch(key: SettingKey, patch: Record<string, unknown>): Record<string, unknown> {
  const defaults = SETTING_DEFAULTS[key] as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch)) {
    if (!(field in defaults) || SERVER_FIELDS[key]?.includes(field)) continue;
    const name = `${key}.${field}`;
    if (SECRET_FIELDS[key]?.includes(field) && typeof value === 'string' && value.startsWith(MASK)) continue;
    out[field] = checkValue(name, defaults[field], value);
  }
  return out;
}

function checkValue(name: string, def: unknown, value: unknown): unknown {
  if (typeof def === 'boolean') return typeof value === 'boolean' ? value : fail(name, 'açık/kapalı olmalı');
  if (typeof def === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fail(name, 'sayı olmalı');
    const [min, max] = RANGES[name] ?? [0, Number.MAX_SAFE_INTEGER];
    if (value < min || value > max) fail(name, `${min} ile ${max} arasında olmalı`);
    if (name === 'checkout.maxQtyPerItem' && !Number.isInteger(value)) fail(name, 'tam sayı olmalı');
    return value;
  }
  if (typeof def === 'string') {
    if (typeof value !== 'string') return fail(name, 'metin olmalı');
    if (value.length > (LONG_TEXT.has(name) ? 10_000 : 500)) fail(name, 'çok uzun');
    if (name.startsWith('productPage.') && !HEX.test(value)) fail(name, '#rrggbb biçiminde bir renk olmalı');
    if (name === 'store.instagram' && value && !/^https:\/\//.test(value)) fail(name, 'https:// ile başlamalı');
    if ((name === 'store.email' || name === 'alerts.email') && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail(name, 'geçerli bir e-posta olmalı');
    if (name === 'alerts.webhookUrl' && value && !webhookAllowed(value)) fail(name, 'Slack, Discord ya da Google Chat webhook adresi olmalı (https://)');
    // Money goes here: a typo or a tampered value must not reach the order e-mails.
    if (name === 'bankTransfer.iban' && value && !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value.replace(/\s/g, ''))) fail(name, 'geçerli bir IBAN olmalı');
    return value;
  }
  if (name === 'alerts.muted') {
    if (!Array.isArray(value) || value.some((c) => !(ALERT_CODES as string[]).includes(c as string))) return fail(name, 'bilinmeyen uyarı kodu');
    return [...new Set(value as string[])];
  }
  if (Array.isArray(def)) {
    // Otherwise the only list is shipping.carriers.
    if (!Array.isArray(value) || value.length > 20) return fail(name, 'en çok 20 kargo firması');
    return value.map((c, i) => {
      const row = (c ?? {}) as Record<string, unknown>;
      const code = typeof row.code === 'string' ? row.code.trim() : '';
      const label = typeof row.name === 'string' ? row.name.trim() : '';
      const url = typeof row.trackingUrl === 'string' ? row.trackingUrl.trim() : '';
      if (!/^[a-z0-9-]{2,30}$/.test(code) || !label || label.length > 60) fail(`${name}[${i}]`, 'kod ve ad gerekli');
      if (url && (!url.startsWith('https://') || !url.includes('{tracking}') || url.length > 300)) fail(`${name}[${i}]`, 'takip adresi https:// ile başlamalı ve {tracking} içermeli');
      return { code, name: label, trackingUrl: url };
    });
  }
  if (def && typeof def === 'object') {
    // Per-language texts (announcement, welcome, bank note).
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(name, 'dil → metin listesi olmalı');
    const texts: Record<string, string> = {};
    for (const [lang, text] of Object.entries(value as Record<string, unknown>)) {
      if (!(LOCALES as readonly string[]).includes(lang)) continue;
      if (typeof text !== 'string' || text.length > 2000) fail(`${name}.${lang}`, 'en çok 2000 karakter metin olmalı');
      texts[lang] = text as string;
    }
    return texts;
  }
  return fail(name, 'desteklenmeyen değer');
}

/** For the admin: secrets as "••••abcd", or empty when none is saved. */
export function maskSecrets<T extends Record<string, unknown>>(key: SettingKey, value: T): T {
  const fields = SECRET_FIELDS[key];
  if (!fields) return value;
  const copy: Record<string, unknown> = { ...value };
  for (const f of fields) {
    const v = copy[f];
    if (typeof v === 'string' && v) copy[f] = `${MASK}${v.slice(-4)}`;
  }
  return copy as T;
}
