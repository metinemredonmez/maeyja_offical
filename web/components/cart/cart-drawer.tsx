'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { money } from '@/lib/format';
import { CartLines } from './cart-lines';
import { useCartUi } from './cart-ui';
import { useCart } from './use-cart';

export function CartDrawer() {
  const { open, closeCart } = useCartUi();
  const { data: cart } = useCart();
  const t = useTranslations('cart');
  const locale = useLocale();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeCart();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, closeCart]);

  if (!open) return null;
  const empty = !cart || cart.lines.length === 0;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label={t('continueShopping')} onClick={closeCart} className="absolute inset-0 bg-ink/30" />
      <aside role="dialog" aria-modal="true" aria-label={t('title')} className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-ground shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-serif text-2xl font-light">
            {t('title')} {cart?.itemCount ? `(${cart.itemCount})` : ''}
          </h2>
          <button type="button" onClick={closeCart} aria-label={t('continueShopping')} className="label hover:text-brand">
            ✕
          </button>
        </div>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
            <p className="text-muted">{t('empty')}</p>
            <Link href="/products" onClick={closeCart} className="btn-outline">
              {t('emptyCta')}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <CartLines compact />
            </div>
            <div className="border-t border-line px-6 py-6">
              {cart.freeShippingRemaining ? <p className="mb-3 text-xs text-muted">{t('freeShippingRemaining', { amount: money(cart.freeShippingRemaining, locale) })}</p> : null}
              <div className="mb-4 flex justify-between text-sm">
                <span>{t('subtotal')}</span>
                <span>{money(cart.subtotal, locale)}</span>
              </div>
              <Link href="/checkout" onClick={closeCart} className="btn-primary w-full">
                {t('checkout')}
              </Link>
              <Link href="/cart" onClick={closeCart} className="label mt-4 block text-center text-muted hover:text-brand">
                {t('title')} →
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
