'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { LOCALE_LABELS, LOCALES } from '@/i18n/routing';
import { api, ApiError } from '@/lib/api.client';
import type { User } from '@/lib/types';
import { Field } from '@/components/contact-form';

export function ProfileForms({ user }: { user: User }) {
  const t = useTranslations('account');
  const ta = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tc('error'));
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run('profile', () => api.patch('/me', { firstName: fd.get('firstName'), lastName: fd.get('lastName'), phone: fd.get('phone') || undefined, locale: fd.get('locale'), marketingOptIn: fd.get('marketingOptIn') === 'on' }), t('saved'));
  };
  const changePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    run('password', () => api.post('/auth/change-password', { currentPassword: fd.get('currentPassword'), newPassword: fd.get('newPassword') }).then(() => form.reset()), t('saved'));
  };
  const resend = () => run('resend', () => api.post('/auth/resend-verification'), ta('forgotSent'));
  const deleteAccount = () => {
    if (!window.confirm(t('deleteAccountText'))) return;
    run('delete', () => api.delete('/me').then(() => api.post('/auth/logout')).then(() => router.replace('/')), t('saved'));
  };

  return (
    <div className="flex flex-col gap-14">
      <form onSubmit={saveProfile} className="flex flex-col gap-4">
        <h2 className="label text-muted">{t('profile')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tc('firstName')} name="firstName" defaultValue={user.firstName ?? ''} required maxLength={60} />
          <Field label={tc('lastName')} name="lastName" defaultValue={user.lastName ?? ''} required maxLength={60} />
          <Field label={tc('phone')} name="phone" type="tel" defaultValue={user.phone ?? ''} />
          <label className="flex flex-col gap-2">
            <span className="label text-muted">{t('language')}</span>
            <select name="locale" defaultValue={user.locale} className="field">
              {LOCALES.map((l) => (
                <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-sm text-muted">{user.email} {!user.emailVerified ? <button type="button" onClick={resend} className="ml-2 underline underline-offset-4">{ta('resend')}</button> : null}</p>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="marketingOptIn" defaultChecked={user.marketingOptIn} className="accent-ink" />
          {ta('marketing')}
        </label>
        <button type="submit" disabled={busy === 'profile'} className="btn-primary self-start">{tc('save')}</button>
      </form>

      <form onSubmit={changePassword} className="flex flex-col gap-4">
        <h2 className="label text-muted">{t('security')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2"><span className="label text-muted">{t('currentPassword')}</span><input name="currentPassword" type="password" required autoComplete="current-password" className="field" /></label>
          <label className="flex flex-col gap-2"><span className="label text-muted">{t('newPassword')}</span><input name="newPassword" type="password" required minLength={8} autoComplete="new-password" className="field" /></label>
        </div>
        <button type="submit" disabled={busy === 'password'} className="btn-outline self-start">{t('changePassword')}</button>
      </form>

      <div className="flex flex-col gap-3 border-t border-line pt-8">
        <p className="text-sm text-muted">{t('deleteAccountText')}</p>
        <button type="button" onClick={deleteAccount} disabled={busy === 'delete'} className="label self-start text-brand hover:underline">{t('deleteAccount')}</button>
      </div>
    </div>
  );
}
