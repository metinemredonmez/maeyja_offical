'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api.client';
import { usePathname, useRouter } from '@/i18n/navigation';

/** Heart next to "Add to bag"; guests are sent to sign in and come back to the product. */
export function WishlistButton({ productId, initial }: { productId: string; initial: boolean }) {
  const t = useTranslations('product');
  const router = useRouter();
  const pathname = usePathname();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      if (on) await api.delete(`/me/wishlist/${productId}`);
      else await api.post('/me/wishlist', { productId });
      setOn(!on);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push(`/account/login?next=${encodeURIComponent(pathname)}` as never);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} aria-label={on ? t('wishlisted') : t('wishlist')} title={on ? t('wishlisted') : t('wishlist')} className="flex h-12 w-12 shrink-0 items-center justify-center border border-line hover:border-ink">
      <svg aria-hidden="true" width="18" height="16" viewBox="0 0 18 16" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.1" className={on ? 'text-brand' : ''}>
        <path d="M9 15S1 10.2 1 5.2A3.9 3.9 0 0 1 9 3.4a3.9 3.9 0 0 1 8 1.8C17 10.2 9 15 9 15Z" />
      </svg>
    </button>
  );
}
