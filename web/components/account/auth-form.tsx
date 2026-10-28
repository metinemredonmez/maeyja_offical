'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api.client';
import { Field } from '@/components/contact-form';

/** Only same-site relative paths are honoured as a post-login target (no open redirect). */
const safeNext = (next?: string) => (next && /^\/(?!\/)/.test(next) ? next : '/account');

export function AuthForm({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries()) as Record<string, string | boolean>;
    if (mode === 'register') {
      body.marketingOptIn = fd.get('marketingOptIn') === 'on';
      body.locale = locale;
    }
    setBusy(true);
    try {
      await api.post(`/auth/${mode}`, body);
      await qc.invalidateQueries({ queryKey: ['cart'] }); // guest cart was merged by the proxy
      router.replace(safeNext(next) as never);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tc('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-12 md:pt-20">
      <h1 className="mb-10 font-serif text-5xl font-light leading-none">{mode === 'login' ? t('login') : t('register')}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === 'register' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tc('firstName')} name="firstName" autoComplete="given-name" required maxLength={60} />
            <Field label={tc('lastName')} name="lastName" autoComplete="family-name" required maxLength={60} />
          </div>
        ) : null}
        <Field label={tc('email')} name="email" type="email" autoComplete="email" required />
        <label className="flex flex-col gap-2">
          <span className="label text-muted">{tc('password')}</span>
          <input name="password" type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="field" />
          {mode === 'register' ? <span className="text-xs text-muted">{t('passwordRule')}</span> : null}
        </label>
        {mode === 'register' ? (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="marketingOptIn" className="mt-0.5 accent-ink" />
            {t('marketing')}
          </label>
        ) : null}
        <button type="submit" disabled={busy} className="btn-primary mt-2">
          {mode === 'login' ? t('login') : t('register')}
        </button>
      </form>
      <div className="mt-8 flex flex-col gap-3 text-sm text-muted">
        {mode === 'login' ? (
          <>
            <Link href="/account/forgot-password" className="hover:text-ink">{t('forgot')}</Link>
            <p>
              {t('noAccount')}{' '}
              <Link href={{ pathname: '/account/register', query: next ? { next } : undefined }} className="underline underline-offset-4 hover:text-ink">{t('register')}</Link>
            </p>
          </>
        ) : (
          <p>
            {t('haveAccount')}{' '}
            <Link href={{ pathname: '/account/login', query: next ? { next } : undefined }} className="underline underline-offset-4 hover:text-ink">{t('login')}</Link>
          </p>
        )}
      </div>
    </div>
  );
}
