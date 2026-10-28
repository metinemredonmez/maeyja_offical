import { z } from 'zod';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
export const PASSWORD_RE = /^(?=.*[A-Za-zÇĞİÖŞÜçğıöşü])(?=.*\d).{8,72}$/;
export const PASSWORD_MSG = 'Şifre en az 8 karakter olmalı, harf ve rakam içermelidir';

export const slugSchema = z.string().regex(SLUG_RE, 'Yalnızca küçük harf, rakam ve tire (örn. signature-bag)');
export const optionalSlug = z.union([z.literal(''), slugSchema]).optional();

/** Text input that should become `undefined` when left blank. */
export const optionalText = (max?: number) => {
  const base = max ? z.string().max(max, `En fazla ${max} karakter`) : z.string();
  return base.optional().transform((v) => (v && v.trim() !== '' ? v : undefined));
};

/** Number input (string from the DOM) → number ≥ 0, blank → undefined. */
export const optionalMoney = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === '' || v === undefined || v === null ? undefined : Number(v)))
  .refine((v) => v === undefined || (!Number.isNaN(v) && v >= 0), 'Sıfır veya daha büyük olmalı')
  .refine((v) => v === undefined || Math.round(v * 100) === v * 100, 'En fazla 2 ondalık basamak');

export const requiredMoney = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .refine((v) => !Number.isNaN(v) && v >= 0, 'Sıfır veya daha büyük bir tutar girin')
  .refine((v) => Math.round(v * 100) === v * 100, 'En fazla 2 ondalık basamak');

export const optionalInt = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === '' || v === undefined || v === null ? undefined : Number(v)))
  .refine((v) => v === undefined || Number.isInteger(v), 'Tam sayı olmalı');

export const requiredInt = z
  .union([z.string(), z.number()])
  .transform((v) => Number(v))
  .refine((v) => Number.isInteger(v), 'Tam sayı olmalı');

export const translationsSchema = z.record(z.string(), z.record(z.string(), z.string())).optional();

export const seoSchema = {
  seoTitle: optionalText(160),
  seoDescription: optionalText(320),
};

export const optionalUrl = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined))
  .refine((v) => v === undefined || /^(https?:\/\/|\/)/.test(v), 'http(s):// ile başlayan bir adres girin');

export const emailSchema = z.string().trim().toLowerCase().email('Geçerli bir e-posta girin');
