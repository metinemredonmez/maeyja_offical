'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FormError, SubmitButton } from '@/components/shared/form';
import { api, hardNavigate } from '@/lib/api.client';
import { loginSchema, mfaVerifySchema, type LoginValues, type MfaVerifyValues } from '@/lib/schemas/auth';
import type { AuthUser } from '@/lib/types';
import { homeForRole } from '@/components/layout/nav';

type LoginResponse = { user: AuthUser } | { mfaRequired: true; mfaToken: string };

function safeNext(next: string | null, user: AuthUser | null | undefined) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : homeForRole(user?.role);
}

/** Second step: TOTP code (or backup code) against the short-lived `mfaToken`. */
function MfaStep({ mfaToken, next, onBack }: { mfaToken: string; next: string | null; onBack: () => void }) {
  const [error, setError] = useState<unknown>(null);
  const form = useForm<MfaVerifyValues>({ resolver: zodResolver(mfaVerifySchema), defaultValues: { code: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const { user } = await api.post<{ user: AuthUser }>('/auth/login/mfa', { mfaToken, code: values.code }, { retry: false });
      hardNavigate(safeNext(next, user));
    } catch (e) {
      setError(e);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="flex items-start gap-2">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <h1 className="text-base font-semibold">İki adımlı doğrulama</h1>
          <p className="text-xs text-muted-foreground">Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin. Uygulamaya erişemiyorsanız yedek kodlarınızdan birini kullanın.</p>
        </div>
      </div>
      <FormError error={error} />
      <Field label="Doğrulama kodu" error={form.formState.errors.code} htmlFor="code" required>
        <Input id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456 veya AB12C-DE34F" className="font-mono tracking-widest" {...form.register('code')} />
      </Field>
      <SubmitButton loading={form.formState.isSubmitting} className="w-full">
        Doğrula
      </SubmitButton>
      <Button type="button" variant="ghost" size="sm" className="w-full" onClick={onBack}>
        Farklı hesapla giriş yap
      </Button>
    </form>
  );
}

function LoginForm() {
  const sp = useSearchParams();
  const expired = sp.get('expired') === '1';
  const next = sp.get('next');
  const [error, setError] = useState<unknown>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const res = await api.post<LoginResponse>('/auth/admin/login', values, { retry: false });
      if ('mfaRequired' in res && res.mfaRequired) {
        setMfaToken(res.mfaToken);
        return;
      }
      hardNavigate(safeNext(next, 'user' in res ? res.user : null));
    } catch (e) {
      setError(e);
    }
  });

  if (mfaToken) {
    return (
      <MfaStep
        mfaToken={mfaToken}
        next={next}
        onBack={() => {
          setMfaToken(null);
          form.reset();
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="text-base font-semibold">Giriş yap</h1>
      {expired && !error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Oturumunuz sona erdi, lütfen yeniden giriş yapın.</p>}
      <FormError error={error} />
      <Field label="E-posta" error={form.formState.errors.email} htmlFor="email" required>
        <Input id="email" type="email" autoComplete="username" autoFocus {...form.register('email')} />
      </Field>
      <Field label="Şifre" error={form.formState.errors.password} htmlFor="password" required>
        <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
      </Field>
      <SubmitButton loading={form.formState.isSubmitting} className="w-full">
        Giriş yap
      </SubmitButton>
      <p className="text-center text-xs">
        <Link href="/forgot-password" className="text-muted-foreground underline-offset-2 hover:underline">
          Şifremi unuttum
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
