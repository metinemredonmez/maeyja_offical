import { z } from 'zod';
import { HEX_RE, optionalInt, optionalMoney, optionalSlug, optionalText, optionalUrl, requiredMoney, seoSchema, translationsSchema } from '@/lib/schemas/common';

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Ürün adı gerekli').max(120, 'En fazla 120 karakter'),
  slug: optionalSlug,
  subtitle: optionalText(160),
  description: optionalText(),
  story: optionalText(),
  material: optionalText(200),
  care: optionalText(),
  dimensions: optionalText(200),
  madeIn: optionalText(60),
  sizeGuide: optionalText(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  isFeatured: z.boolean(),
  basePrice: requiredMoney,
  compareAtPrice: optionalMoney,
  taxRate: optionalInt.refine((v) => v === undefined || (v >= 0 && v <= 100), '0-100 arası olmalı'),
  categoryId: z.string().optional(),
  collectionIds: z.array(z.string()),
  tags: z.string().optional(),
  translations: translationsSchema,
  ...seoSchema,
});
export type ProductFormValues = z.input<typeof productSchema>;
export type ProductFormOutput = z.output<typeof productSchema>;

export const variantSchema = z.object({
  sku: z.string().trim().min(1, 'SKU gerekli').max(64),
  colorId: z.string().optional(),
  size: optionalText(16),
  price: optionalMoney,
  compareAtPrice: optionalMoney,
  stock: optionalInt.transform((v) => v ?? 0).refine((v) => v >= 0, 'Stok negatif olamaz'),
  barcode: optionalText(64),
  weightGrams: optionalInt.refine((v) => v === undefined || v >= 0, 'Negatif olamaz'),
  isActive: z.boolean(),
});
export type VariantFormValues = z.input<typeof variantSchema>;
export type VariantFormOutput = z.output<typeof variantSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Ad gerekli').max(80),
  slug: optionalSlug,
  description: optionalText(1000),
  imageUrl: optionalUrl,
  parentId: z.string().optional(),
  sortOrder: optionalInt,
  isActive: z.boolean(),
  translations: translationsSchema,
  ...seoSchema,
});
export type CategoryFormValues = z.input<typeof categorySchema>;

export const collectionSchema = z.object({
  name: z.string().trim().min(1, 'Ad gerekli').max(80),
  slug: optionalSlug,
  description: optionalText(2000),
  coverImageUrl: optionalUrl,
  sortOrder: optionalInt,
  isActive: z.boolean(),
  translations: translationsSchema,
  ...seoSchema,
});
export type CollectionFormValues = z.input<typeof collectionSchema>;

export const colorSchema = z.object({
  name: z.string().trim().min(1, 'Ad gerekli').max(40),
  slug: optionalSlug,
  hex: z.string().regex(HEX_RE, 'Örn. #A3121B'),
  hex2: z.union([z.literal(''), z.string().regex(HEX_RE, 'Örn. #1A1A1A')]).optional(),
  sortOrder: optionalInt,
  translations: translationsSchema,
});
export type ColorFormValues = z.input<typeof colorSchema>;
