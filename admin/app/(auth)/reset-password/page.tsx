'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Field, FormError, SubmitButton } from '@/components/shared/form';
import { api } from '@/lib/api.client';
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/schemas/auth';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const form = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirm: '' } });

  if (!token) {
    return (
      <div className="space-y-3">
        <h1 className="text-base font-semibold">Geçersiz bağlantı</h1>
        <p className="text-sm text-muted-foreground">Sıfırlama bağlantısı eksik veya bozuk.</p>
        <Link href="/forgot-password" className="text-xs underline underline-offset-2">
          Yeni bağlantı iste
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-3">
        <h1 className="text-base font-semibold">Şifre güncellendi</h1>
        <p className="text-sm text-muted-foreground">Yeni şifrenizle giriş yapabilirsiniz.</p>
        <Link href="/login" className="text-xs underline underline-offset-2">
          Girişe git
        </Link>
      </div>
    );
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password: values.password });
      setDone(true);
    } catch (e) {
      setError(e);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="text-base font-semibold">Yeni şifre belirle</h1>
      <FormError error={error} />
      <Field label="Yeni şifre" error={form.formState.errors.password} htmlFor="password" hint="En az 8 karakter, harf ve rakam" required>
        <Input id="password" type="password" autoComplete="new-password" autoFocus {...form.register('password')} />
      </Field>
      <Field label="Yeni şifre (tekrar)" error={form.formState.errors.confirm} htmlFor="confirm" required>
        <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} />
      </Field>
      <SubmitButton loading={form.formState.isSubmitting} className="w-full">
        Şifreyi güncelle
      </SubmitButton>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
