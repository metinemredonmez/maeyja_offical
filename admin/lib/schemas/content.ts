import { z } from 'zod';
import { optionalInt, optionalSlug, optionalText, optionalUrl, seoSchema, slugSchema, translationsSchema } from '@/lib/schemas/common';

export const homeSectionSchema = z.object({
  type: z.enum(['HERO', 'FEATURED_PRODUCTS', 'COLLECTION', 'EDITORIAL', 'CRAFT_STORY', 'PRESS', 'STOCKISTS', 'NEWSLETTER']),
  title: optionalText(160),
  subtitle: optionalText(300),
  body: optionalText(),
  imageUrl: optionalUrl,
  mobileImageUrl: optionalUrl,
  secondImageUrl: optionalUrl,
  videoUrl: optionalUrl,
  layout: z.string().optional(),
  ctaLabel: optionalText(60),
  ctaUrl: optionalText(300),
  productIds: z.array(z.string()),
  collectionSlug: z.string().optional(),
  limit: optionalInt.refine((v) => v === undefined || (v >= 1 && v <= 24), '1-24 arası'),
  isActive: z.boolean(),
  translations: translationsSchema,
});
export type HomeSectionFormValues = z.input<typeof homeSectionSchema>;
export type HomeSectionFormOutput = z.output<typeof homeSectionSchema>;

export const pageSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1, 'Başlık gerekli').max(160),
  body: z.string().min(1, 'İçerik gerekli'),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  translations: translationsSchema,
  ...seoSchema,
});
export type PageFormValues = z.input<typeof pageSchema>;

export const journalSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli').max(160),
  slug: optionalSlug,
  excerpt: optionalText(400),
  body: z.string().min(1, 'İçerik gerekli'),
  coverImageUrl: optionalUrl,
  status: z.enum(['DRAFT', 'PUBLISHED']),
  publishedAt: z.string().optional(),
  translations: translationsSchema,
  ...seoSchema,
});
export type JournalFormValues = z.input<typeof journalSchema>;

export const pressSchema = z.object({
  publication: z.string().trim().min(1, 'Yayın adı gerekli').max(80),
  title: optionalText(200),
  quote: optionalText(400),
  url: optionalUrl,
  logoUrl: optionalUrl,
  imageUrl: optionalUrl,
  publishedAt: z.string().optional(),
  sortOrder: optionalInt,
  isActive: z.boolean(),
});
export type PressFormValues = z.input<typeof pressSchema>;

export const stockistSchema = z.object({
  name: z.string().trim().min(1, 'Ad gerekli').max(120),
  city: z.string().trim().min(1, 'Şehir gerekli').max(60),
  country: z.string().trim().length(2, 'İki harfli ülke kodu (TR)').toUpperCase(),
  address: optionalText(300),
  phone: optionalText(30),
  url: optionalUrl,
  mapUrl: optionalUrl,
  sortOrder: optionalInt,
  isActive: z.boolean(),
});
export type StockistFormValues = z.input<typeof stockistSchema>;

export const faqSchema = z.object({
  group: optionalText(60),
  question: z.string().trim().min(1, 'Soru gerekli').max(300),
  answer: z.string().min(1, 'Cevap gerekli'),
  sortOrder: optionalInt,
  isActive: z.boolean(),
  translations: translationsSchema,
});
export type FaqFormValues = z.input<typeof faqSchema>;

export const pushSchema = z
  .object({
    title: z.string().trim().min(1, 'Başlık gerekli').max(80),
    body: z.string().trim().min(1, 'Metin gerekli').max(240),
    url: optionalText(500),
    imageUrl: optionalUrl,
    target: z.enum(['ALL', 'USERS']),
    userIds: z.array(z.string()),
  })
  .refine((v) => v.target !== 'USERS' || v.userIds.length > 0, { path: ['userIds'], message: 'En az bir kullanıcı seçin' });
export type PushFormValues = z.input<typeof pushSchema>;
