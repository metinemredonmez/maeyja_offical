import { renderCampaign, unsubscribeSignature, verifyUnsubscribeSignature } from './campaign.mail';

const key = Buffer.alloc(32, 7);

describe('campaign unsubscribe signature', () => {
  it('verifies only the matching recipient', () => {
    const sig = unsubscribeSignature('rec_1', key);
    expect(verifyUnsubscribeSignature('rec_1', sig, key)).toBe(true);
    expect(verifyUnsubscribeSignature('rec_2', sig, key)).toBe(false);
    expect(verifyUnsubscribeSignature('rec_1', 'x'.repeat(32), key)).toBe(false);
    expect(verifyUnsubscribeSignature('rec_1', 'short', key)).toBe(false);
  });
});

describe('renderCampaign', () => {
  const opts = { locale: 'de', unsubscribeUrl: 'https://maeyja.com/de/unsubscribe?r=a&t=b', webUrl: 'https://maeyja.com', sender: { name: 'MAEYJA', address: 'İstanbul', email: 'hello@maeyja.com' } };

  it('adds preheader, absolute CTA and an unsubscribe link', () => {
    const m = renderCampaign({ subject: 'Yeni', preheader: 'Gizli satır', title: 'Başlık', body: '<p>Merhaba</p><img src="https://x/y.webp">', ctaLabel: 'Keşfet', ctaUrl: '/products' }, opts);
    expect(m.subject).toBe('Yeni');
    expect(m.html).toContain('Gizli satır');
    expect(m.html).toContain('href="https://maeyja.com/products"');
    expect(m.html).toContain('href="https://maeyja.com/de/unsubscribe?r=a&amp;t=b"');
    expect(m.html).toContain('Unsubscribe'); // non-Turkish recipients get the English footer
    expect(m.html).toContain('<img style="max-width:100%');
    expect(m.text).toContain('https://maeyja.com/de/unsubscribe?r=a&t=b');
  });

  it('escapes the title', () => {
    expect(renderCampaign({ subject: 's', title: '<b>x</b>', body: '<p>y</p>' }, { ...opts, locale: 'tr' }).html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
