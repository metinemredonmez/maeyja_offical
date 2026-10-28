import { z } from 'zod';
import { emailSchema, PASSWORD_MSG, PASSWORD_RE } from '@/lib/schemas/common';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Şifre gerekli').max(72),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().regex(PASSWORD_RE, PASSWORD_MSG),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Şifreler eşleşmiyor' });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mevcut şifre gerekli').max(72),
    newPassword: z.string().regex(PASSWORD_RE, PASSWORD_MSG),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Şifreler eşleşmiyor' });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

/** 6-digit TOTP code or a backup code such as `AB12C-DE34F`. */
export const mfaCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, '').toUpperCase())
  .pipe(z.string().regex(/^(\d{6}|[A-Z0-9]{5}-[A-Z0-9]{5})$/, '6 haneli kod veya yedek kod (AB12C-DE34F) girin'));

export const mfaVerifySchema = z.object({ code: mfaCodeSchema });
export type MfaVerifyValues = z.input<typeof mfaVerifySchema>;

export const mfaDisableSchema = z.object({
  password: z.string().min(1, 'Şifre gerekli').max(72),
  code: mfaCodeSchema,
});
export type MfaDisableValues = z.input<typeof mfaDisableSchema>;

export const createStaffSchema = z.object({
  email: emailSchema,
  password: z.string().regex(PASSWORD_RE, PASSWORD_MSG),
  firstName: z.string().trim().min(1, 'Ad gerekli').max(60),
  lastName: z.string().trim().min(1, 'Soyad gerekli').max(60),
  role: z.enum(['EDITOR', 'ADMIN', 'SUPER_ADMIN']),
});
export type CreateStaffValues = z.infer<typeof createStaffSchema>;
