'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api.client';

/**
 * Asks for a click instead of unsubscribing on page load, so mail scanners that prefetch links
 * can't unsubscribe people. (Mail clients' own "Unsubscribe" button uses the one-click header instead.)
 */
export function Unsubscribe({ r, t: signature }: { r: string; t: string }) {
  const t = useTranslations('unsubscribe');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'fail'>(r && signature ? 'idle' : 'fail');

  const submit = async () => {
    setState('busy');
    try {
      await api.post('/newsletter/unsubscribe', { r, t: signature });
      setState('done');
    } catch {
      setState('fail');
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-12 md:pt-20">
      <h1 className="mb-6 font-serif text-5xl font-light leading-none">{t('title')}</h1>
      {state === 'done' || state === 'fail' ? (
        <p className="text-[15px]">{state === 'done' ? t('done') : t('fail')}</p>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-[15px]">{t('text')}</p>
          <button type="button" onClick={submit} disabled={state === 'busy'} className="btn-primary self-start">
            {t('button')}
          </button>
        </div>
      )}
      <Link href="/" className="link-underline mt-10 inline-block">
        {t('back')}
      </Link>
    </div>
  );
}
