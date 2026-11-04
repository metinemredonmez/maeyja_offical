import { cleanSettingPatch, maskSecrets } from './settings.validate';

describe('setting writes (INP-01, EXT-05)', () => {
  it('rejects values outside the type or range of the default', () => {
    expect(() => cleanSettingPatch('shipping', { flatRate: -50 })).toThrow();
    expect(() => cleanSettingPatch('shipping', { flatRate: '0' })).toThrow();
    expect(() => cleanSettingPatch('tax', { defaultRate: 150 })).toThrow();
    expect(() => cleanSettingPatch('checkout', { guestCheckout: 'yes' })).toThrow();
    expect(() => cleanSettingPatch('productPage', { ground: 'red;background:url(x)' })).toThrow();
    expect(() => cleanSettingPatch('bankTransfer', { iban: 'not an iban' })).toThrow();
    expect(() => cleanSettingPatch('shipping', { carriers: [{ code: 'x1', name: 'X', trackingUrl: 'javascript:alert(1){tracking}' }] })).toThrow();
  });

  it('never lets a PUT set the preview token, and drops unknown fields', () => {
    expect(cleanSettingPatch('maintenance', { enabled: true, previewToken: 'weak' })).toEqual({ enabled: true });
    expect(cleanSettingPatch('store', { name: 'MAEYJA', admin: true })).toEqual({ name: 'MAEYJA' });
  });

  it('keeps a masked secret unchanged and masks it on the way out', () => {
    expect(cleanSettingPatch('tracking', { metaCapiToken: '••••abcd', ga4Id: 'G-ABC123' })).toEqual({ ga4Id: 'G-ABC123' });
    expect(maskSecrets('tracking', { metaCapiToken: 'EAAsecretvalue1234', ga4ApiSecret: '' })).toEqual({ metaCapiToken: '••••1234', ga4ApiSecret: '' });
  });

  it('accepts what the admin really sends', () => {
    expect(cleanSettingPatch('bankTransfer', { iban: 'TR33 0006 1005 1978 6457 8413 26', note: { tr: 'Sipariş no', en: 'Order no', xx: 'dropped' } })).toEqual({
      iban: 'TR33 0006 1005 1978 6457 8413 26',
      note: { tr: 'Sipariş no', en: 'Order no' },
    });
    expect(cleanSettingPatch('shipping', { flatRate: 150, freeShippingThreshold: 5000 })).toEqual({ flatRate: 150, freeShippingThreshold: 5000 });
  });

  it('takes an alert webhook only from the allowed chat services and keeps it masked (EXT-01, EXT-05)', () => {
    expect(() => cleanSettingPatch('alerts', { webhookUrl: 'https://evil.example/hook' })).toThrow();
    expect(() => cleanSettingPatch('alerts', { webhookUrl: 'http://hooks.slack.com/services/x' })).toThrow();
    expect(() => cleanSettingPatch('alerts', { muted: ['no.such.alert'] })).toThrow();
    expect(cleanSettingPatch('alerts', { webhookUrl: '••••abcd', muted: ['quota.warning', 'quota.warning'] })).toEqual({ muted: ['quota.warning'] });
    expect(maskSecrets('alerts', { email: '', webhookUrl: 'https://hooks.slack.com/services/T/B/secret', muted: [] }).webhookUrl).toBe('••••cret');
  });
});
