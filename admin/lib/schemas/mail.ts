import { z } from 'zod';
import { emailSchema, optionalText, requiredInt } from '@/lib/schemas/common';
import { hasContent, splitAddresses } from '@/lib/mail';

const port = requiredInt.refine((v) => v >= 1 && v <= 65535, '1–65535 arası bir port girin');

/** Mirrors backend MailAccountDto. `password` blank on edit = keep the stored one. */
export const mailAccountSchema = z.object({
  email: emailSchema.max(200, 'En fazla 200 karakter'),
  password: z.string().max(200, 'En fazla 200 karakter'),
  fromName: optionalText(120),
  imapHost: z.string().trim().min(1, 'IMAP sunucusu gerekli').max(255),
  imapPort: port,
  imapSecure: z.boolean(),
  smtpHost: z.string().trim().min(1, 'SMTP sunucusu gerekli').max(255),
  smtpPort: port,
  smtpSecure: z.boolean(),
  allowSelfSigned: z.boolean(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  signatureHtml: optionalText(5000),
});
export type MailAccountFormValues = z.input<typeof mailAccountSchema>;

/** Creating an account needs the password. */
export const newMailAccountSchema = mailAccountSchema.refine((v) => v.password.trim() !== '', { path: ['password'], message: 'Şifre gerekli' });

const MAX_RECIPIENTS = 50;
const single = z.string().email();

/** Comma / space separated address list, each one validated. */
const addressList = z.string().superRefine((value, ctx) => {
  const list = splitAddresses(value);
  const bad = list.filter((a) => !single.safeParse(a).success);
  if (bad.length) ctx.addIssue({ code: 'custom', message: `Geçersiz adres: ${bad.join(', ')}` });
  else if (list.length > MAX_RECIPIENTS) ctx.addIssue({ code: 'custom', message: `En fazla ${MAX_RECIPIENTS} adres` });
});

export const composeSchema = z.object({
  accountId: z.string().min(1, 'Gönderen hesabı seçin'),
  to: addressList.refine((v) => splitAddresses(v).length > 0, 'En az bir alıcı girin'),
  cc: addressList,
  subject: z.string().trim().min(1, 'Konu gerekli').max(300, 'En fazla 300 karakter'),
  html: z.string().max(200_000, 'İçerik çok uzun').refine(hasContent, 'İçerik gerekli'),
});
export type ComposeFormValues = z.input<typeof composeSchema>;
