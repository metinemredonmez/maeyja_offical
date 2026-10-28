'use client';

import { useCart } from './use-cart';
import { useCartUi } from './cart-ui';

export function CartButton({ label }: { label: string }) {
  const { data } = useCart();
  const { openCart } = useCartUi();
  const count = data?.itemCount ?? 0;
  return (
    <button type="button" onClick={openCart} className="label hover:text-brand" aria-label={`${label} (${count})`}>
      {label}&nbsp;({count})
    </button>
  );
}
