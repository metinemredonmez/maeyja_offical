/**
 * Ad pixels in the browser (Meta Pixel, GA4, Google Ads). Nothing loads until the visitor accepts cookies; the
 * server sends the same Purchase with the order number as event id, so it is counted once.
 */

export type TrackingIds = { metaPixelId: string; ga4Id: string; googleAdsId: string; googleAdsPurchaseLabel: string };
export type TrackItem = { id: string; name: string; price: number; quantity: number; variant?: string | null };
type Consent = 'granted' | 'denied';

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; push: unknown; loaded: boolean; version: string };
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    __mjIds?: TrackingIds;
  }
}

const CONSENT_KEY = 'mj-consent';
export const CONSENT_EVENT = 'mj-consent';
const PENDING_KEY = 'mj-purchase';

export function getConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: Consent) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  document.cookie = `mj_consent=${value}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

function addScript(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/** Events fired before the pixels load (first page, consent still pending) wait here; dropped if refused. */
const waiting: (() => void)[] = [];

/** Loads the configured pixels once (after consent), then sends whatever was waiting. */
export function loadPixels(ids: TrackingIds) {
  window.__mjIds = ids;
  if (ids.metaPixelId && !window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = window._fbq = fbq;
    addScript('https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', ids.metaPixelId);
  }
  const tag = ids.ga4Id || ids.googleAdsId;
  if (tag && !window.gtag) {
    window.dataLayer = window.dataLayer || [];
    // gtag must queue the `arguments` object itself, not an array.
    window.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    if (ids.ga4Id) window.gtag('config', ids.ga4Id, { send_page_view: false });
    if (ids.googleAdsId) window.gtag('config', ids.googleAdsId);
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tag)}`);
  }
  waiting.splice(0).forEach((send) => send());
}

export function trackPageView() {
  window.fbq?.('track', 'PageView');
  window.gtag?.('event', 'page_view', { page_location: location.href, page_title: document.title });
}

const META_NAMES = { view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'Purchase' } as const;

/** One commerce event to every loaded pixel (no-op without consent). */
export function track(event: keyof typeof META_NAMES, data: { value: number; items: TrackItem[]; transactionId?: string }) {
  if (!window.__mjIds) {
    if (getConsent() !== 'denied') waiting.push(() => track(event, data));
    return;
  }
  const { value, items, transactionId } = data;
  window.fbq?.(
    'track',
    META_NAMES[event],
    {
      currency: 'TRY',
      value,
      content_type: 'product',
      content_ids: items.map((i) => i.id),
      contents: items.map((i) => ({ id: i.id, quantity: i.quantity })),
      num_items: items.reduce((n, i) => n + i.quantity, 0),
    },
    transactionId ? { eventID: transactionId } : undefined,
  );
  window.gtag?.('event', event, {
    currency: 'TRY',
    value,
    ...(transactionId ? { transaction_id: transactionId } : {}),
    items: items.map((i) => ({ item_id: i.id, item_name: i.name, item_variant: i.variant ?? undefined, price: i.price, quantity: i.quantity })),
  });
  const ids = window.__mjIds;
  if (event === 'purchase' && ids?.googleAdsId && ids.googleAdsPurchaseLabel) {
    window.gtag?.('event', 'conversion', { send_to: `${ids.googleAdsId}/${ids.googleAdsPurchaseLabel}`, value, currency: 'TRY', transaction_id: transactionId });
  }
}

const cookie = (name: string) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];

/** What the server needs to send the same Purchase (only with consent): Meta's _fbp/_fbc, GA's client id. */
export function attribution() {
  if (getConsent() !== 'granted') return undefined;
  const ga = cookie('_ga')?.split('.');
  return {
    fbp: cookie('_fbp'),
    fbc: cookie('_fbc'),
    gaClientId: ga && ga.length >= 4 ? `${ga[2]}.${ga[3]}` : undefined,
    userAgent: navigator.userAgent.slice(0, 400),
  };
}

/** Card payments leave the site for 3-D Secure; the Purchase is fired when the shopper comes back paid. */
export function savePendingPurchase(orderNumber: string, value: number, items: TrackItem[]) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ orderNumber, value, items }));
  } catch {
    /* private mode */
  }
}

export function firePendingPurchase(orderNumber: string) {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as { orderNumber: string; value: number; items: TrackItem[] } | null;
    if (!pending || pending.orderNumber !== orderNumber) return;
    sessionStorage.removeItem(PENDING_KEY);
    track('purchase', { value: pending.value, items: pending.items, transactionId: orderNumber });
  } catch {
    /* nothing to send */
  }
}
