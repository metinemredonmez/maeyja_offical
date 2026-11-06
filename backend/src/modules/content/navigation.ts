import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LOCALES } from '../../common/utils/i18n.util';

/** Admin → Üst menü ve alt bilgi: the storefront's header and footer, kept in the Setting table under this key. */
export const NAVIGATION_KEY = 'navigation';

type Texts = Record<string, string>;
/**
 * `bags`, `expertise`, `stores` and `menu` open a picture menu under the header; `link` is a plain link. The bags
 * menu also lists the models and the stores menu the stockists, by themselves.
 */
export const HEADER_KINDS = ['bags', 'expertise', 'stores', 'menu', 'link'] as const;
export type HeaderKind = (typeof HEADER_KINDS)[number];
/** What a picture menu shows: a heading, links under it and pictures beside them — all set in the admin. */
export type PanelLink = { label: Texts; key: string; href: string };
/** An empty label on a picture of a model page shows the model's name. */
export type PanelTile = { image: string; label: Texts; key: string; href: string };
export type MenuPanel = { title: Texts; titleKey: string; links: PanelLink[]; tiles: PanelTile[] };
export type HeaderItem = { id: string; kind: HeaderKind; label: Texts; key: string; href: string; side: 'left' | 'right'; visible: boolean; panel?: MenuPanel };
/** `href` empty: plain text; `#cookies`: the cookie settings button. */
export type FooterLink = { label: Texts; key: string; href: string };
export type FooterColumn = { id: string; title: Texts; key: string; links: FooterLink[]; visible: boolean };
export type Navigation = {
  header: { items: HeaderItem[]; languages: boolean; account: boolean };
  footer: { columns: FooterColumn[]; newsletter: boolean; instagram: boolean; languages: boolean; payments: boolean };
};

/**
 * `key` is a storefront message (`nav.bags`) used in every language the admin left empty, so the defaults stay in
 * all 11 languages without anyone typing them.
 */
const item = (id: string, kind: HeaderItem['kind'], key: string, side: HeaderItem['side'], href = ''): HeaderItem => ({ id, kind, label: {}, key, href, side, visible: true });
const link = (key: string, href: string): FooterLink => ({ label: {}, key, href });
const tile = (image: string, href: string, key = ''): PanelTile => ({ image, label: {}, key, href });

/** What each picture menu shows until the admin changes it (and for a saved header from before menus had content). */
export const PANEL_DEFAULTS: Record<Exclude<HeaderKind, 'link'>, MenuPanel> = {
  bags: {
    title: {},
    titleKey: 'nav.byModel',
    links: [],
    tiles: [tile('/menu/bags-origami.webp', '/products/petal-box-chili'), tile('/menu/bags-tulip.webp', '/products/petal-bucket-12-chili'), tile('/menu/bags-frame.webp', '/products/petal-shoulder-24-botanic')],
  },
  // The shop owner's wish: only the heading and "Our story".
  expertise: { title: {}, titleKey: 'nav.expertise', links: [link('home.ourStory', '/about')], tiles: [] },
  stores: {
    title: {},
    titleKey: 'stockists.title',
    links: [],
    tiles: [tile('/menu/store-city.webp', '/stockists', 'stockists.title'), tile('/menu/store-shelves.webp', '/products', 'stockists.online'), tile('/menu/store-contact.webp', '/contact', 'footer.contact')],
  },
  menu: { title: {}, titleKey: '', links: [], tiles: [] },
};

const withPanel = (i: HeaderItem): HeaderItem => (i.kind === 'link' ? i : { ...i, panel: i.panel ?? structuredClone(PANEL_DEFAULTS[i.kind]) });

/** A header saved before picture menus had content gets the default content of its kind. */
export const withPanels = (nav: Navigation): Navigation => ({ ...nav, header: { ...nav.header, items: nav.header.items.map(withPanel) } });

export const NAVIGATION_DEFAULTS: Navigation = {
  header: {
    items: [
      withPanel(item('bags', 'bags', 'nav.bags', 'left')),
      withPanel(item('expertise', 'expertise', 'nav.expertise', 'left')),
      // Off at the shop owner's wish; one switch in the admin brings it back.
      { ...item('journal', 'link', 'nav.journal', 'left', '/journal'), visible: false },
      withPanel(item('stores', 'stores', 'nav.stores', 'right')),
    ],
    languages: true,
    account: true,
  },
  footer: {
    columns: [
      {
        id: 'shop',
        title: {},
        key: 'footer.shop',
        visible: true,
        links: [link('nav.bags', '/products'), link('footer.clothing', ''), link('footer.care', '/care'), link('home.stockists', '/stockists'), link('footer.about', '/about')],
      },
      {
        id: 'help',
        title: {},
        key: 'footer.help',
        visible: true,
        links: [link('footer.shippingReturns', '/shipping-returns'), link('footer.orderStatus', '/order-status'), link('footer.faq', '/faq'), link('footer.contact', '/contact')],
      },
      {
        id: 'legal',
        title: {},
        key: 'footer.legal',
        visible: true,
        links: [
          link('footer.distance', '/distance-sales-agreement'),
          link('footer.preliminary', '/preliminary-information'),
          link('footer.kvkk', '/kvkk'),
          link('footer.privacy', '/privacy'),
          link('consent.settings', '#cookies'),
          link('footer.terms', '/terms'),
        ],
      },
    ],
    newsletter: true,
    instagram: true,
    languages: true,
    payments: true,
  },
};

const fail = (field: string, why: string): never => {
  throw new BadRequestException(`${field}: ${why}`);
};

const KEY = /^(nav|footer|home|consent|stockists)\.[A-Za-z]{1,40}$/;
const ID = /^[\w-]{1,40}$/;
/** A page of the shop (no `//host`) or an https address; nothing else (javascript:, data:) reaches an href. */
const INTERNAL = /^\/(?!\/)[\w\-./~#?=&%]*$/;
const EXTERNAL = /^https:\/\/[^\s"'<>\\]+$/;
/** The storefront's own menu pictures; anything else must be one of our uploads (the image optimiser loads no other host). */
const SHOP_PICTURE = /^\/(menu|instagram)\/[\w\-.]+\.(webp|jpe?g|png|avif)$/;

const bool = (name: string, v: unknown) => (typeof v === 'boolean' ? v : fail(name, 'açık/kapalı olmalı'));
const key = (name: string, v: unknown) => (v === undefined || v === '' ? '' : typeof v === 'string' && KEY.test(v) ? v : fail(name, 'geçersiz metin anahtarı'));
const id = (v: unknown) => (typeof v === 'string' && ID.test(v) ? v : randomUUID().slice(0, 8));

function texts(name: string, v: unknown): Texts {
  if (v === undefined) return {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fail(name, 'dil → metin listesi olmalı');
  const out: Texts = {};
  for (const [lang, text] of Object.entries(v as Record<string, unknown>)) {
    if (!(LOCALES as readonly string[]).includes(lang)) continue;
    if (typeof text !== 'string' || text.length > 80) fail(`${name}.${lang}`, 'en çok 80 karakter olmalı');
    if ((text as string).trim()) out[lang] = (text as string).trim();
  }
  return out;
}

function href(name: string, v: unknown, footer: boolean): string {
  const value = typeof v === 'string' ? v.trim() : v === undefined ? '' : fail(name, 'metin olmalı');
  if (footer && (value === '' || value === '#cookies')) return value;
  if (value.length > 300 || !(INTERNAL.test(value) || EXTERNAL.test(value))) fail(name, '/ ile başlayan bir sayfa ya da https:// adresi olmalı');
  return value;
}

const list = (name: string, v: unknown, max: number): Record<string, unknown>[] =>
  Array.isArray(v) && v.length <= max ? v.map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {})) : fail(name, `en çok ${max} öğe olmalı`);

/** A picture from the media library (our uploads) or the storefront's own folders; anything else is refused. */
export function picture(name: string, v: unknown, uploadBase: string): string {
  const value = typeof v === 'string' ? v.trim() : '';
  const upload = uploadBase && value.startsWith(`${uploadBase.replace(/\/$/, '')}/`) && EXTERNAL.test(value) && !value.includes('..');
  if (value.length > 500 || !(SHOP_PICTURE.test(value) || upload)) fail(name, 'medya kütüphanesinden bir fotoğraf olmalı');
  return value;
}

function panel(name: string, v: unknown, uploadBase: string): MenuPanel {
  const p = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    title: texts(`${name}.title`, p.title),
    titleKey: key(`${name}.titleKey`, p.titleKey),
    links: list(`${name}.links`, p.links ?? [], 12).map((l, j) => {
      const label = texts(`${name}.links[${j}].label`, l.label);
      const lk = key(`${name}.links[${j}].key`, l.key);
      if (!label.tr && !lk) fail(`${name}.links[${j}].label`, 'Türkçe ad gerekli');
      return { label, key: lk, href: href(`${name}.links[${j}].href`, l.href, false) };
    }),
    tiles: list(`${name}.tiles`, p.tiles ?? [], 4).map((t, j) => ({
      image: picture(`${name}.tiles[${j}].image`, t.image, uploadBase),
      label: texts(`${name}.tiles[${j}].label`, t.label),
      key: key(`${name}.tiles[${j}].key`, t.key),
      href: href(`${name}.tiles[${j}].href`, t.href, false),
    })),
  };
}

/**
 * INP-01: a header/footer PUT is rebuilt field by field; unknown fields are dropped, every link is checked.
 * `uploadBase` (UPLOAD_PUBLIC_URL): menu pictures may only come from there or from the storefront's own /menu folder.
 */
export function cleanNavigation(body: unknown, uploadBase = ''): Navigation {
  const root = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const header = (root.header ?? {}) as Record<string, unknown>;
  const footer = (root.footer ?? {}) as Record<string, unknown>;
  return {
    header: {
      items: list('header.items', header.items, 10).map((it, i) => {
        const name = `header.items[${i}]`;
        const kind = (HEADER_KINDS as readonly unknown[]).includes(it.kind) ? (it.kind as HeaderItem['kind']) : fail(`${name}.kind`, 'geçersiz tür');
        const label = texts(`${name}.label`, it.label);
        const k = key(`${name}.key`, it.key);
        if (!label.tr && !k) fail(`${name}.label`, 'Türkçe ad gerekli');
        const out: HeaderItem = {
          id: id(it.id),
          kind,
          label,
          key: k,
          href: kind === 'link' ? href(`${name}.href`, it.href, false) : '',
          side: it.side === 'right' ? 'right' : 'left',
          visible: bool(`${name}.visible`, it.visible),
        };
        // An item saved without content keeps the default content of its kind.
        if (kind !== 'link') out.panel = it.panel === undefined ? structuredClone(PANEL_DEFAULTS[kind]) : panel(`${name}.panel`, it.panel, uploadBase);
        return out;
      }),
      languages: bool('header.languages', header.languages),
      account: bool('header.account', header.account),
    },
    footer: {
      columns: list('footer.columns', footer.columns, 6).map((col, i) => {
        const name = `footer.columns[${i}]`;
        const title = texts(`${name}.title`, col.title);
        const k = key(`${name}.key`, col.key);
        if (!title.tr && !k) fail(`${name}.title`, 'Türkçe başlık gerekli');
        return {
          id: id(col.id),
          title,
          key: k,
          visible: bool(`${name}.visible`, col.visible),
          links: list(`${name}.links`, col.links, 12).map((l, j) => {
            const label = texts(`${name}.links[${j}].label`, l.label);
            const lk = key(`${name}.links[${j}].key`, l.key);
            if (!label.tr && !lk) fail(`${name}.links[${j}].label`, 'Türkçe ad gerekli');
            return { label, key: lk, href: href(`${name}.links[${j}].href`, l.href, true) };
          }),
        };
      }),
      newsletter: bool('footer.newsletter', footer.newsletter),
      instagram: bool('footer.instagram', footer.instagram),
      languages: bool('footer.languages', footer.languages),
      payments: bool('footer.payments', footer.payments),
    },
  };
}
