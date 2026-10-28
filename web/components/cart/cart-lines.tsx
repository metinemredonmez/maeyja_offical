'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api.client';
import { money } from '@/lib/format';
import { useCart, useCartMutations } from './use-cart';

export function CartLines({ compact = false }: { compact?: boolean }) {
  const { data: cart } = useCart();
  const { setQuantity, remove } = useCartMutations();
  const t = useTranslations('cart');
  const locale = useLocale();
  if (!cart) return null;

  const change = (variantId: string, quantity: number) =>
    setQuantity.mutate({ variantId, quantity }, { onError: (e) => toast.error(e instanceof ApiError ? e.message : t('unavailable')) });

  return (
    <ul className="flex flex-col divide-y divide-line">
      {cart.lines.map((l) => (
        <li key={l.variantId} className="flex gap-4 py-5">
          <Link href={`/products/${l.productSlug}`} className="ph relative block aspect-[4/5] w-20 shrink-0 overflow-hidden md:w-24">
            {l.imageUrl ? <Image src={l.imageUrl} alt={l.productName} fill sizes="96px" className="object-cover" /> : null}
          </Link>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/products/${l.productSlug}`} className="text-sm hover:text-brand">
                {l.productName}
              </Link>
              <span className="text-sm">{money(l.lineTotal, locale)}</span>
            </div>
            {l.variantName ? <p className="text-xs text-muted">{l.variantName}</p> : null}
            {!l.available ? <p className="text-xs text-brand">{t('unavailable')}</p> : null}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center border border-line" aria-label={t('quantity')}>
                <button type="button" aria-label="−" onClick={() => change(l.variantId, l.quantity - 1)} className="h-9 w-9 hover:bg-sand">
                  −
                </button>
                <span className="w-8 text-center text-sm">{l.quantity}</span>
                <button type="button" aria-label="+" disabled={l.quantity >= l.maxQuantity} onClick={() => change(l.variantId, l.quantity + 1)} className="h-9 w-9 hover:bg-sand disabled:opacity-40">
                  +
                </button>
              </div>
              <button type="button" onClick={() => remove.mutate(l.variantId)} className="label text-muted hover:text-brand">
                {t('remove')}
              </button>
            </div>
            {!compact ? <p className="mt-1 text-xs text-muted">{money(l.unitPrice, locale)} × {l.quantity}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
