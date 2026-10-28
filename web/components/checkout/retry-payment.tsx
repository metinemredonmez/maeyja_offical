'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api.client';
import type { CheckoutResult } from '@/lib/types';

/** Re-opens the iyzico page for an unpaid order. Guests prove ownership with the checkout email. */
export function RetryPayment({ orderNumber, guest }: { orderNumber: string; guest: boolean }) {
  const t = useTranslations('checkout');
  const tc = useTranslations('common');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const retry = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<CheckoutResult>(`/orders/${orderNumber}/pay`, guest ? { email } : {});
      if (r.payment?.paymentPageUrl) window.location.assign(r.payment.paymentPageUrl);
      else toast.error(tc('error'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tc('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={retry} className="mt-4 flex w-full max-w-sm flex-col gap-3">
      {guest ? <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tc('email')} className="field" aria-label={tc('email')} /> : null}
      <button type="submit" disabled={busy} className="btn-primary">
        {t('retryPayment')}
      </button>
    </form>
  );
}
