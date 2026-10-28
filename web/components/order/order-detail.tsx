'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api.client';
import { formatDate, money } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';
import { RetryPayment } from '@/components/checkout/retry-payment';

const STEPS: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

export function OrderDetail({ order, guestEmail }: { order: Order; guestEmail?: string }) {
  const t = useTranslations('order');
  const tcart = useTranslations('cart');
  const tco = useTranslations('checkout');
  const locale = useLocale();
  const stepIndex = STEPS.indexOf(order.status);
  const terminal = order.status === 'CANCELLED' || order.status === 'REFUNDED';
  const addr = order.shippingAddress;
  const canReturn = (order.status === 'DELIVERED' || order.status === 'SHIPPED') && !order.returnRequests.some((r) => r.status === 'REQUESTED' || r.status === 'APPROVED');

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-6">
        <div>
          <h2 className="font-serif text-3xl font-light">{t('title', { orderNumber: order.orderNumber })}</h2>
          <p className="mt-1 text-sm text-muted">{formatDate(order.createdAt, locale, { dateStyle: 'long' })}</p>
        </div>
        <span className={`label border px-3 py-1.5 ${terminal ? 'border-line text-muted' : 'border-ink'}`}>{t(`statuses.${order.status}`)}</span>
      </header>

      {!terminal && order.status !== 'PENDING_PAYMENT' ? (
        <ol className="grid grid-cols-4 gap-2" aria-label={t('status')}>
          {STEPS.map((s, i) => (
            <li key={s} className={`border-t-2 pt-3 text-[11px] uppercase tracking-label ${i <= stepIndex ? 'border-ink' : 'border-line text-muted'}`}>
              {t(`statuses.${s}`)}
            </li>
          ))}
        </ol>
      ) : null}

      {order.status === 'PENDING_PAYMENT' ? (
        order.paymentProvider === 'BANK_TRANSFER' && order.bankTransfer ? (
          <div className="border border-line p-6 text-sm">
            <p className="label mb-4 text-muted">{tco('bankDetails')}</p>
            <p>{order.bankTransfer.bankName}</p>
            <p>{order.bankTransfer.accountName}</p>
            <p className="mt-2 font-mono text-base">{order.bankTransfer.iban}</p>
            <p className="mt-4 text-muted">{order.bankTransfer.note?.[locale] ?? order.bankTransfer.note?.tr ?? tco('bankNote')}</p>
          </div>
        ) : (
          <RetryPayment orderNumber={order.orderNumber} guest={Boolean(guestEmail)} />
        )
      ) : null}

      {order.trackingNumber ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border border-line p-5 text-sm">
          <span>
            <span className="label block text-muted">{t('tracking')}</span>
            {order.carrier} · {order.trackingNumber}
          </span>
          {order.trackingUrl ? <a href={order.trackingUrl} rel="noopener" target="_blank" className="link-underline">{t('track')}</a> : null}
        </div>
      ) : null}

      <section>
        <h3 className="label mb-4 text-muted">{t('items')}</h3>
        <ul className="divide-y divide-line">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-4 py-4 text-sm">
              <div className="ph relative aspect-[4/5] w-16 shrink-0">{i.imageUrl ? <Image src={i.imageUrl} alt="" fill sizes="64px" className="object-cover" /> : null}</div>
              <div className="flex flex-1 justify-between gap-4">
                <span>
                  {i.productName}
                  {i.variantName ? <span className="block text-xs text-muted">{i.variantName}</span> : null}
                  <span className="block text-xs text-muted">× {i.quantity}</span>
                </span>
                <span>{money(i.lineTotal, locale)}</span>
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt>{tcart('subtotal')}</dt><dd>{money(order.subtotal, locale)}</dd></div>
          {order.discountTotal > 0 ? <div className="flex justify-between"><dt>{tcart('discount')}</dt><dd>−{money(order.discountTotal, locale)}</dd></div> : null}
          <div className="flex justify-between"><dt>{tcart('shipping')}</dt><dd>{money(order.shippingTotal, locale)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 text-base"><dt>{tcart('total')}</dt><dd>{money(order.total, locale)}</dd></div>
        </dl>
      </section>

      <section className="grid gap-8 text-sm sm:grid-cols-2">
        <div>
          <h3 className="label mb-3 text-muted">{tco('shippingAddress')}</h3>
          <p>{addr.firstName} {addr.lastName}</p>
          <p>{addr.line1} {addr.line2}</p>
          <p>{addr.district} / {addr.city} {addr.postalCode}</p>
          <p className="text-muted">{addr.phone}</p>
        </div>
        <div>
          <h3 className="label mb-3 text-muted">{t('paymentMethod')}</h3>
          <p>{order.paymentProvider === 'IYZICO' ? tco('card') : tco('bankTransfer')}</p>
        </div>
      </section>

      {order.returnRequests.length ? (
        <ul className="text-sm text-muted">
          {order.returnRequests.map((r) => (
            <li key={r.id}>{formatDate(r.createdAt, locale)} · {r.status} · {r.reason}</li>
          ))}
        </ul>
      ) : null}
      {canReturn ? <ReturnForm order={order} guestEmail={guestEmail} /> : null}
    </div>
  );
}

function ReturnForm({ order, guestEmail }: { order: Order; guestEmail?: string }) {
  const t = useTranslations('order');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const items = order.items.filter((i) => fd.get(`item-${i.id}`)).map((i) => ({ orderItemId: i.id, quantity: Number(fd.get(`qty-${i.id}`) || 1) }));
    if (!items.length) return;
    setBusy(true);
    try {
      await api.post(`/orders/${order.orderNumber}/returns`, { reason: fd.get('reason'), items, email: guestEmail || undefined });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tc('error'));
    } finally {
      setBusy(false);
    }
  };

  if (done) return <p className="text-sm">{t('returnSent')}</p>;
  if (!open)
    return (
      <div className="flex flex-col items-start gap-2">
        <button type="button" onClick={() => setOpen(true)} className="link-underline">{t('requestReturn')}</button>
        <p className="text-xs text-muted">{t('returnWindow')}</p>
      </div>
    );
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border border-line p-6">
      <p className="label text-muted">{t('returnItems')}</p>
      {order.items.map((i) => (
        <label key={i.id} className="flex items-center gap-3 text-sm">
          <input type="checkbox" name={`item-${i.id}`} className="accent-ink" />
          <span className="flex-1">{i.productName}{i.variantName ? ` · ${i.variantName}` : ''}</span>
          <input type="number" name={`qty-${i.id}`} min={1} max={i.quantity} defaultValue={1} className="field w-20 py-1.5" aria-label="Qty" />
        </label>
      ))}
      <label className="flex flex-col gap-2">
        <span className="label text-muted">{t('returnReason')}</span>
        <textarea name="reason" required minLength={5} rows={3} className="field" />
      </label>
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="btn-primary">{t('requestReturn')}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-outline">{tc('cancel')}</button>
      </div>
    </form>
  );
}
