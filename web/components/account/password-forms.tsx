'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api.client';

/** Forgot / reset / verify-email: three tiny flows that share a layout. */
export function PasswordForms({ mode, token = '' }: { mode: 'forgot' | 'reset' | 'verify'; token?: string }) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'fail'>(mode === 'verify' ? 'busy' : 'idle');

  useEffect(() => {
    if (mode !== 'verify') return;
    api.post('/auth/verify-email', { token }).then(() => setState('done')).catch(() => setState('fail'));
  }, [mode, token]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState('busy');
    try {
      if (mode === 'forgot') await api.post('/auth/forgot-password', { email: fd.get('email') });
      else await api.post('/auth/reset-password', { token, password: fd.get('password') });
      setState('done');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tc('error'));
      setState('idle');
    }
  };

  const title = mode === 'forgot' ? t('forgot') : mode === 'reset' ? t('reset') : t('verifyTitle');

  return (
    <div className="mx-auto max-w-md px-4 pt-12 md:pt-20">
      <h1 className="mb-6 font-serif text-5xl font-light leading-none">{title}</h1>
      {mode === 'verify' ? (
        <p className="text-[15px]">{state === 'busy' ? tc('loading') : state === 'done' ? t('verifyOk') : t('verifyFail')}</p>
      ) : state === 'done' ? (
        <p className="text-[15px]">{mode === 'forgot' ? t('forgotSent') : t('resetDone')}</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {mode === 'forgot' ? (
            <>
              <p className="text-sm text-muted">{t('forgotText')}</p>
              <input name="email" type="email" required autoComplete="email" placeholder={tc('email')} className="field" aria-label={tc('email')} />
            </>
          ) : (
            <label className="flex flex-col gap-2">
              <span className="label text-muted">{tc('password')}</span>
              <input name="password" type="password" required minLength={8} autoComplete="new-password" className="field" />
              <span className="text-xs text-muted">{t('passwordRule')}</span>
            </label>
          )}
          <button type="submit" disabled={state === 'busy'} className="btn-primary">
            {tc('continue')}
          </button>
        </form>
      )}
      <Link href="/account/login" className="label mt-8 inline-block text-muted hover:text-ink">
        {t('login')}
      </Link>
    </div>
  );
}
