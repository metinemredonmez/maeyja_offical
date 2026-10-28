'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api.client';
import { money } from '@/lib/format';
import { CartLines } from '@/components/cart/cart-lines';
import { useCart, useCartMutations } from '@/components/cart/use-cart';

export default function CartPage() {
  const t = useTranslations('cart');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { data: cart, isLoading } = useCart();
  const { applyCoupon, removeCoupon } = useCartMutations();
  const [code, setCode] = useState('');

  const submitCoupon = (e: FormEvent) => {
    e.preventDefault();
    applyCoupon.mutate(code, { onError: (err) => toast.error(err instanceof ApiError ? err.message : t('couponInvalid')) });
  };

  if (isLoading) return <div className="px-4 py-24 text-center text-muted md:px-12">…</div>;
  const empty = !cart || cart.lines.length === 0;

  return (
    <div className="px-4 pt-12 md:px-12 md:pt-20">
      <h1 className="mb-10 font-serif text-5xl font-light leading-none md:text-[56px]">{t('title')}</h1>
      {empty ? (
        <div className="flex flex-col items-start gap-6 py-10">
          <p className="text-muted">{t('empty')}</p>
          <Link href="/products" className="btn-outline">
            {t('emptyCta')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-7">
            <CartLines />
          </div>
          <aside className="flex flex-col gap-6 md:col-span-4 md:col-start-9">
            <form onSubmit={submitCoupon} className="flex flex-col gap-2">
              <label htmlFor="coupon" className="label text-muted">
                {t('coupon')}
              </label>
              {cart.coupon?.valid ? (
                <div className="flex items-center justify-between border border-line px-4 py-3 text-sm">
                  <span>{cart.coupon.code}</span>
                  <button type="button" onClick={() => removeCoupon.mutate()} className="label text-muted hover:text-brand">
                    {t('remove')}
                  </button>
                </div>
              ) : (
                <div className="flex">
                  <input id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="field border-r-0 uppercase" />
                  <button type="submit" disabled={!code || applyCoupon.isPending} className="btn-outline shrink-0 px-5">
                    {t('apply')}
                  </button>
                </div>
              )}
            </form>

            <dl className="flex flex-col gap-3 border-t border-line pt-6 text-sm">
              <Row label={t('subtotal')} value={money(cart.subtotal, locale)} />
              {cart.discountTotal > 0 ? <Row label={t('discount')} value={`−${money(cart.discountTotal, locale)}`} /> : null}
              <Row label={t('shipping')} value={cart.shippingTotal > 0 ? money(cart.shippingTotal, locale) : tc('free')} />
              <Row label={t('tax')} value={money(cart.taxTotal, locale)} muted />
              <div className="flex justify-between border-t border-line pt-3 text-base">
                <dt>{t('total')}</dt>
                <dd>{money(cart.total, locale)}</dd>
              </div>
            </dl>
            {cart.freeShippingRemaining ? <p className="text-xs text-muted">{t('freeShippingRemaining', { amount: money(cart.freeShippingRemaining, locale) })}</p> : null}
            <Link href="/checkout" className={`btn-primary w-full ${!cart.allAvailable ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={!cart.allAvailable}>
              {t('checkout')}
            </Link>
            <Link href="/products" className="label text-center text-muted hover:text-brand">
              {t('continueShopping')}
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-xs text-muted' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
