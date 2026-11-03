import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LOCALES } from '../../common/utils/i18n.util';

/** Admin → Üst menü ve alt bilgi: the storefront's header and footer, kept in the Setting table under this key. */
export const NAVIGATION_KEY = 'navigation';

type Texts = Record<string, string>;
/** `bags`, `expertise` and `stores` open the storefront's picture menus; `link` is a plain link. */
export const HEADER_KINDS = ['bags', 'expertise', 'stores', 'link'] as const;
export type HeaderItem = { id: string; kind: (typeof HEADER_KINDS)[number]; label: Texts; key: string; href: string; side: 'left' | 'right'; visible: boolean };
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

export const NAVIGATION_DEFAULTS: Navigation = {
  header: {
    items: [
      item('bags', 'bags', 'nav.bags', 'left'),
      item('expertise', 'expertise', 'nav.expertise', 'left'),
      item('journal', 'link', 'nav.journal', 'left', '/journal'),
      item('stores', 'stores', 'nav.stores', 'right'),
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

const KEY = /^(nav|footer|home|consent)\.[A-Za-z]{1,40}$/;
const ID = /^[\w-]{1,40}$/;
/** A page of the shop (no `//host`) or an https address; nothing else (javascript:, data:) reaches an href. */
const INTERNAL = /^\/(?!\/)[\w\-./~#?=&%]*$/;
const EXTERNAL = /^https:\/\/[^\s"'<>\\]+$/;

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

/** INP-01: a header/footer PUT is rebuilt field by field; unknown fields are dropped, every link is checked. */
export function cleanNavigation(body: unknown): Navigation {
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
        return {
          id: id(it.id),
          kind,
          label,
          key: k,
          href: kind === 'link' ? href(`${name}.href`, it.href, false) : '',
          side: it.side === 'right' ? 'right' : 'left',
          visible: bool(`${name}.visible`, it.visible),
        };
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
