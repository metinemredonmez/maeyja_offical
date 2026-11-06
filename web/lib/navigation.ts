import { useLocale, useTranslations } from 'next-intl';
import type { Navigation, NavFooterLink, NavHeaderItem, NavPanel } from './types';

const item = (id: string, kind: NavHeaderItem['kind'], key: string, side: NavHeaderItem['side'], href = ''): NavHeaderItem => ({ id, kind, label: {}, key, href, side, visible: true });
const link = (key: string, href: string): NavFooterLink => ({ label: {}, key, href });
const tile = (image: string, href: string, key = '') => ({ image, label: {}, key, href });

/** The API's default menu contents (backend navigation.ts), for when it can't be reached. */
export const DEFAULT_PANELS: Record<Exclude<NavHeaderItem['kind'], 'link'>, NavPanel> = {
  bags: {
    title: {},
    titleKey: 'nav.byModel',
    links: [],
    tiles: [tile('/menu/bags-origami.webp', '/products/petal-box-chili'), tile('/menu/bags-tulip.webp', '/products/petal-bucket-12-chili'), tile('/menu/bags-frame.webp', '/products/petal-shoulder-24-botanic')],
  },
  expertise: { title: {}, titleKey: 'nav.expertise', links: [link('home.ourStory', '/about')], tiles: [] },
  stores: {
    title: {},
    titleKey: 'stockists.title',
    links: [],
    tiles: [tile('/menu/store-city.webp', '/stockists', 'stockists.title'), tile('/menu/store-shelves.webp', '/products', 'stockists.online'), tile('/menu/store-contact.webp', '/contact', 'footer.contact')],
  },
  menu: { title: {}, titleKey: '', links: [], tiles: [] },
};

/** The API's defaults, for when it can't be reached: the shop keeps its menus. */
export const DEFAULT_NAVIGATION: Navigation = {
  header: {
    items: [item('bags', 'bags', 'nav.bags', 'left'), item('expertise', 'expertise', 'nav.expertise', 'left'), { ...item('journal', 'link', 'nav.journal', 'left', '/journal'), visible: false }, item('stores', 'stores', 'nav.stores', 'right')],
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

/** Where a picture-menu item goes in the phone menu (a custom menu: its first link). */
export const KIND_HREF: Record<Exclude<NavHeaderItem['kind'], 'link' | 'menu'>, string> = { bags: '/products', expertise: '/expertise', stores: '/stockists' };

export const panelOf = (i: NavHeaderItem): NavPanel => i.panel ?? DEFAULT_PANELS[i.kind === 'link' ? 'menu' : i.kind];

export function mobileHref(i: NavHeaderItem): string {
  if (i.kind === 'link') return i.href;
  if (i.kind === 'menu') return panelOf(i).links[0]?.href ?? panelOf(i).tiles[0]?.href ?? '/';
  return KIND_HREF[i.kind];
}

export const isExternal = (href: string) => href.startsWith('https://');
