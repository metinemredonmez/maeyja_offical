import { z } from 'zod';
import { optionalInt, optionalMoney, optionalText, requiredMoney } from '@/lib/schemas/common';

export const statusChangeSchema = z.object({
  status: z.enum(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
  note: optionalText(500),
  restock: z.boolean(),
  refundOnProvider: z.boolean(),
  notifyCustomer: z.boolean(),
});
export type StatusChangeValues = z.input<typeof statusChangeSchema>;

export const shipSchema = z.object({
  carrier: z.string().min(1, 'Kargo firması seçin').max(40),
  trackingNumber: z.string().trim().min(1, 'Takip numarası gerekli').max(64),
  trackingUrl: optionalText(500),
  notifyCustomer: z.boolean(),
});
export type ShipValues = z.input<typeof shipSchema>;

export const returnUpdateSchema = z.object({
  status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'REFUNDED']),
  adminNote: optionalText(1000),
});
export type ReturnUpdateValues = z.input<typeof returnUpdateSchema>;

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9_-]{3,32}$/, 'Kod 3-32 karakter: harf, rakam, - veya _')),
    description: optionalText(200),
    type: z.enum(['PERCENT', 'FIXED', 'FREE_SHIPPING']),
    value: requiredMoney,
    minOrderAmount: optionalMoney,
    maxDiscount: optionalMoney,
    usageLimit: optionalInt.refine((v) => v === undefined || v >= 1, 'En az 1'),
    usageLimitPerUser: optionalInt.refine((v) => v === undefined || v >= 1, 'En az 1'),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    isActive: z.boolean(),
  })
  .refine((v) => v.type !== 'PERCENT' || (v.value > 0 && v.value <= 100), { path: ['value'], message: 'Yüzde indirim 1-100 arasında olmalı' })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.startsAt) <= new Date(v.endsAt), { path: ['endsAt'], message: 'Bitiş tarihi başlangıçtan önce olamaz' });
export type CouponFormValues = z.input<typeof couponSchema>;
export type CouponFormOutput = z.output<typeof couponSchema>;
