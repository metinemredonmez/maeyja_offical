import { cleanNavigation, NAVIGATION_DEFAULTS } from './navigation';

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
