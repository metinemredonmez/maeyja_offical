import { cleanNavigation, NAVIGATION_DEFAULTS, PANEL_DEFAULTS, withPanels } from './navigation';

const withHeaderLink = (href: string) => ({
  ...NAVIGATION_DEFAULTS,
  header: { ...NAVIGATION_DEFAULTS.header, items: [{ kind: 'link', label: { tr: 'Kampanya' }, href, side: 'left', visible: true }] },
});

describe('header and footer (INP-01)', () => {
  it('keeps the defaults as they are', () => {
    expect(cleanNavigation(NAVIGATION_DEFAULTS)).toEqual(NAVIGATION_DEFAULTS);
  });

  it('accepts a shop page or an https address, and gives a new item an id', () => {
    const page = cleanNavigation(withHeaderLink('/products?category=bags'));
    expect(page.header.items[0]).toMatchObject({ href: '/products?category=bags', side: 'left' });
    expect(page.header.items[0].id).toMatch(/^[\w-]+$/);
    expect(cleanNavigation(withHeaderLink('https://www.instagram.com/maeyja_official/')).header.items[0].href).toBe('https://www.instagram.com/maeyja_official/');
  });

  it.each(['javascript:alert(1)', '//evil.example', 'http://evil.example', 'data:text/html,x', '/a"onmouseover="x'])('refuses the link %s', (href) => {
    expect(() => cleanNavigation(withHeaderLink(href))).toThrow(/sayfa ya da https/);
  });

  it('refuses unknown kinds, unnamed items, message keys from other namespaces and long lists', () => {
    const bad = (items: unknown[]) => () => cleanNavigation({ ...NAVIGATION_DEFAULTS, header: { ...NAVIGATION_DEFAULTS.header, items } });
    expect(bad([{ kind: 'script', label: { tr: 'x' }, side: 'left', visible: true }])).toThrow(/tür/);
    expect(bad([{ kind: 'bags', label: {}, side: 'left', visible: true }])).toThrow(/Türkçe ad/);
    expect(bad([{ kind: 'bags', key: 'meta.description', side: 'left', visible: true }])).toThrow(/anahtar/);
    expect(bad(Array.from({ length: 11 }, () => NAVIGATION_DEFAULTS.header.items[0]))).toThrow(/en çok 10/);
  });

  it('drops unknown fields and languages', () => {
    const out = cleanNavigation({
      ...NAVIGATION_DEFAULTS,
      extra: 1,
      header: { ...NAVIGATION_DEFAULTS.header, items: [{ kind: 'bags', label: { tr: 'Çantalar', xx: 'y' }, side: 'right', visible: true, html: '<b>' }] },
    });
    expect(out).not.toHaveProperty('extra');
    expect(out.header.items[0]).not.toHaveProperty('html');
    expect(out.header.items[0].label).toEqual({ tr: 'Çantalar' });
  });
});

describe('picture menus', () => {
  const UPLOADS = 'https://api.shop.test/uploads';
  const withPanel = (panel: unknown) => ({
    ...NAVIGATION_DEFAULTS,
    header: { ...NAVIGATION_DEFAULTS.header, items: [{ kind: 'expertise', key: 'nav.expertise', side: 'left', visible: true, panel }] },
  });

  it('ships the expertise menu with only "Our story", and the journal switched off', () => {
    expect(PANEL_DEFAULTS.expertise).toEqual({ title: {}, titleKey: 'nav.expertise', links: [{ label: {}, key: 'home.ourStory', href: '/about' }], tiles: [] });
    expect(NAVIGATION_DEFAULTS.header.items.find((i) => i.id === 'journal')?.visible).toBe(false);
  });

  it('gives an item saved before menus had content the default content of its kind', () => {
    const old = { ...NAVIGATION_DEFAULTS, header: { ...NAVIGATION_DEFAULTS.header, items: [{ id: 'bags', kind: 'bags', label: {}, key: 'nav.bags', href: '', side: 'left', visible: true }] } };
    expect(withPanels(old as never).header.items[0].panel).toEqual(PANEL_DEFAULTS.bags);
    expect(cleanNavigation(old).header.items[0].panel).toEqual(PANEL_DEFAULTS.bags);
  });

  it('takes links, headings and pictures from the media library', () => {
    const out = cleanNavigation(
      withPanel({ title: { tr: 'Atölye' }, links: [{ label: { tr: 'Hikâyemiz' }, href: '/about' }], tiles: [{ image: `${UPLOADS}/media/a-800.webp`, label: { tr: 'Dikiş' }, href: '/expertise' }] }),
      UPLOADS,
    );
    expect(out.header.items[0].panel).toEqual({
      title: { tr: 'Atölye' },
      titleKey: '',
      links: [{ label: { tr: 'Hikâyemiz' }, key: '', href: '/about' }],
      tiles: [{ image: `${UPLOADS}/media/a-800.webp`, label: { tr: 'Dikiş' }, key: '', href: '/expertise' }],
    });
  });

  it.each(['https://evil.example/x.webp', 'https://api.shop.test/uploads/../etc/x.webp', '/menu/../../x.webp', 'javascript:alert(1)', ''])('refuses the picture %s', (image) => {
    expect(() => cleanNavigation(withPanel({ tiles: [{ image, label: {}, href: '/' }] }), UPLOADS)).toThrow(/medya/);
  });

  it('refuses unsafe links, unnamed links and too many pictures', () => {
    expect(() => cleanNavigation(withPanel({ links: [{ label: { tr: 'x' }, href: 'javascript:alert(1)' }] }), UPLOADS)).toThrow(/sayfa ya da https/);
    expect(() => cleanNavigation(withPanel({ links: [{ label: {}, href: '/about' }] }), UPLOADS)).toThrow(/Türkçe ad/);
    expect(() => cleanNavigation(withPanel({ tiles: Array.from({ length: 5 }, () => ({ image: '/menu/a.webp', href: '/' })) }), UPLOADS)).toThrow(/en çok 4/);
  });
});
