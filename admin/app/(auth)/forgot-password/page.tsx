'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Field, FormError, SubmitButton } from '@/components/shared/form';
import { api } from '@/lib/api.client';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/schemas/auth';

export default function ForgotPasswordPage() {
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);
  const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api.post('/auth/forgot-password', values);
      setSent(true);
    } catch (e) {
      setError(e);
    }
  });

  if (sent) {
    return (
      <div className="space-y-3">
        <h1 className="text-base font-semibold">E-posta gönderildi</h1>
        <p className="text-sm text-muted-foreground">Adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.</p>
        <Link href="/login" className="text-xs underline underline-offset-2">
          Girişe dön
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="text-base font-semibold">Şifremi unuttum</h1>
      <p className="text-xs text-muted-foreground">E-posta adresinize sıfırlama bağlantısı göndereceğiz.</p>
      <FormError error={error} />
      <Field label="E-posta" error={form.formState.errors.email} htmlFor="email" required>
        <Input id="email" type="email" autoComplete="username" autoFocus {...form.register('email')} />
      </Field>
      <SubmitButton loading={form.formState.isSubmitting} className="w-full">
        Bağlantı gönder
      </SubmitButton>
      <p className="text-center text-xs">
        <Link href="/login" className="text-muted-foreground underline-offset-2 hover:underline">
          Girişe dön
        </Link>
      </p>
    </form>
  );
}
