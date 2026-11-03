import { useLocale, useTranslations } from 'next-intl';
import type { Navigation, NavFooterLink, NavHeaderItem } from './types';

const item = (id: string, kind: NavHeaderItem['kind'], key: string, side: NavHeaderItem['side'], href = ''): NavHeaderItem => ({ id, kind, label: {}, key, href, side, visible: true });
const link = (key: string, href: string): NavFooterLink => ({ label: {}, key, href });

/** The API's defaults, for when it can't be reached: the shop keeps its menus. */
export const DEFAULT_NAVIGATION: Navigation = {
  header: {
    items: [item('bags', 'bags', 'nav.bags', 'left'), item('expertise', 'expertise', 'nav.expertise', 'left'), item('journal', 'link', 'nav.journal', 'left', '/journal'), item('stores', 'stores', 'nav.stores', 'right')],
    languages: true,
    account: true,
  },
  footer: {
    columns: [
      { id: 'shop', title: {}, key: 'footer.shop', visible: true, links: [link('nav.bags', '/products'), link('footer.clothing', ''), link('footer.care', '/care'), link('home.stockists', '/stockists'), link('footer.about', '/about')] },
      { id: 'help', title: {}, key: 'footer.help', visible: true, links: [link('footer.shippingReturns', '/shipping-returns'), link('footer.orderStatus', '/order-status'), link('footer.faq', '/faq'), link('footer.contact', '/contact')] },
      {
        id: 'legal',
        title: {},
        key: 'footer.legal',
        visible: true,
        links: [link('footer.distance', '/distance-sales-agreement'), link('footer.preliminary', '/preliminary-information'), link('footer.kvkk', '/kvkk'), link('footer.privacy', '/privacy'), link('consent.settings', '#cookies'), link('footer.terms', '/terms')],
      },
    ],
    newsletter: true,
    instagram: true,
    languages: true,
    payments: true,
  },
};

/** The text the admin typed for this language, else the shop's own message, else English or Turkish. */
export function useNavLabel() {
  const t = useTranslations();
  const locale = useLocale();
  return (texts: Record<string, string>, key: string) => texts[locale] || (key && t.has(key) ? t(key) : '') || texts.en || texts.tr || '';
}

/** Where a picture-menu item goes in the phone menu. */
export const KIND_HREF: Record<Exclude<NavHeaderItem['kind'], 'link'>, string> = { bags: '/products', expertise: '/expertise', stores: '/stockists' };

export const isExternal = (href: string) => href.startsWith('https://');
