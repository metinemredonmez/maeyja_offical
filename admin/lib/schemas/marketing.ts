import { z } from 'zod';
import { optionalText } from '@/lib/schemas/common';

export const campaignSchema = z.object({
  subject: z.string().trim().min(1, 'Konu gerekli').max(150),
  preheader: optionalText(200),
  title: optionalText(160),
  body: z.string().trim().min(1, 'İçerik gerekli').max(50000),
  ctaLabel: optionalText(60),
  ctaUrl: optionalText(500).refine((v) => !v || /^(https:\/\/|\/)/.test(v), 'https:// ile ya da / ile başlamalı'),
  audience: z.enum(['ALL', 'SUBSCRIBERS', 'CUSTOMERS']),
  locale: z.string(),
});
export type CampaignFormValues = z.input<typeof campaignSchema>;
