'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api.client';

export function NewsletterForm({ compact = false, source = 'footer', buttonLabel }: { compact?: boolean; source?: string; buttonLabel?: string }) {
  const t = useTranslations('newsletter');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('busy');
    try {
      await api.post('/newsletter/subscribe', { email, locale, source });
      setState('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '');
      setState('error');
    }
  };

  if (state === 'done') return <p className="text-sm text-muted">{t('done')}</p>;
  return (
    <form onSubmit={submit} className={`flex ${compact ? 'max-w-xs' : ''}`}>
      <label htmlFor={`nl-${source}`} className="sr-only">
        {t('placeholder')}
      </label>
      <input id={`nl-${source}`} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('placeholder')} className="field border-r-0" />
      <button type="submit" disabled={state === 'busy'} className="btn-primary shrink-0 px-5">
        {buttonLabel ?? t('button')}
      </button>
      {state === 'error' ? <p className="sr-only">{error}</p> : null}
    </form>
  );
}
