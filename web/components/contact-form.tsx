'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api.client';

export function ContactForm() {
  const t = useTranslations('contact');
  const tc = useTranslations('common');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api.post('/contact', Object.fromEntries(fd.entries()));
      setDone(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tc('error'));
    } finally {
      setBusy(false);
    }
  };

  if (done) return <p className="text-[15px]">{t('sent')}</p>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={t('name')} name="name" required />
      <Field label={tc('email')} name="email" type="email" required />
      <Field label={tc('phone')} name="phone" type="tel" />
      <Field label={t('subject')} name="subject" />
      <label className="flex flex-col gap-2">
        <span className="label text-muted">{t('message')}</span>
        <textarea name="message" required minLength={5} rows={6} className="field" />
      </label>
      {/* Honeypot: hidden from people, bots fill it */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <button type="submit" disabled={busy} className="btn-primary self-start">
        {t('send')}
      </button>
    </form>
  );
}

export function Field({ label, name, type = 'text', required, autoComplete, defaultValue, minLength, maxLength, pattern }: { label: string; name: string; type?: string; required?: boolean; autoComplete?: string; defaultValue?: string; minLength?: number; maxLength?: number; pattern?: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="label text-muted">{label}</span>
      <input name={name} type={type} required={required} autoComplete={autoComplete} defaultValue={defaultValue} minLength={minLength} maxLength={maxLength} pattern={pattern} className="field" />
    </label>
  );
}
