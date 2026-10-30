'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { CONSENT_EVENT, firePendingPurchase, getConsent, loadPixels, setConsent, trackPageView, type TrackingIds } from '@/lib/tracking';

const OPEN_EVENT = 'mj-consent-open';

/**
 * Cookie consent + ad pixels. The banner only appears when a pixel is set up in the admin; the pixels load after
 * "Accept", and every page view is counted from then on. "Cookie preferences" in the footer reopens it.
 */
export function Tracking({ ids }: { ids: TrackingIds }) {
  const t = useTranslations('consent');
  const pathname = usePathname();
  const active = Boolean(ids.metaPixelId || ids.ga4Id || ids.googleAdsId);
  const [ask, setAsk] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (!active) return;
    const apply = () => {
      const c = getConsent();
      setAsk(c === null);
      if (c === 'granted') {
        loadPixels(ids);
        setGranted(true);
      }
    };
    apply();
    const reopen = () => setAsk(true);
    addEventListener(CONSENT_EVENT, apply);
    addEventListener(OPEN_EVENT, reopen);
    return () => {
      removeEventListener(CONSENT_EVENT, apply);
      removeEventListener(OPEN_EVENT, reopen);
    };
  }, [active, ids]);

  useEffect(() => {
    if (granted) trackPageView();
  }, [granted, pathname]);

  if (!active || !ask) return null;
  return (
    <div role="dialog" aria-label={t('title')} className="fixed bottom-4 left-4 z-40 flex max-w-[380px] flex-col gap-4 border border-line bg-ground p-5 shadow-[0_12px_40px_rgba(0,0,0,0.12)] md:bottom-6 md:left-6">
      <p className="text-[13px] leading-relaxed text-ink-soft">
        {t('text')}{' '}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-brand">
          {t('more')}
        </Link>
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => setConsent('granted')} className="btn-primary flex-1">
          {t('accept')}
        </button>
        <button type="button" onClick={() => setConsent('denied')} className="btn-outline flex-1">
          {t('reject')}
        </button>
      </div>
    </div>
  );
}

/** Footer link that reopens the consent choice. */
export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => dispatchEvent(new Event(OPEN_EVENT))} className="text-left hover:text-brand">
      {label}
    </button>
  );
}

/** Fires the browser Purchase when a card payment comes back paid (the server sends its twin). */
export function PurchaseEvent({ orderNumber }: { orderNumber: string }) {
  useEffect(() => {
    firePendingPurchase(orderNumber);
  }, [orderNumber]);
  return null;
}
