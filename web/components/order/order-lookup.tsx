'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api.client';
import type { Order } from '@/lib/types';
import { OrderDetail } from './order-detail';

export function OrderLookup({ initialOrderNumber }: { initialOrderNumber: string }) {
  const t = useTranslations('order');
  const tc = useTranslations('common');
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      setOrder(await api.post<Order>('/orders/lookup', { orderNumber, email }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tc('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 flex flex-col gap-12">
      <form onSubmit={lookup} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-2">
          <span className="label text-muted">{t('orderNumber')}</span>
          <input required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} placeholder="MY-261028-1234" className="field uppercase" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="label text-muted">{tc('email')}</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
        </label>
        <button type="submit" disabled={busy} className="btn-primary">
          {t('lookup')}
        </button>
      </form>
      {order ? <OrderDetail order={order} guestEmail={email} /> : null}
    </div>
  );
}
