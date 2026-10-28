import { localize, resolveLocale } from './i18n.util';
import { fromKurus, includedVatKurus, toKurus } from './money.util';
import { slugify } from './slug.util';

describe('money', () => {
  it('rounds to kuruş without float drift', () => {
    expect(toKurus(0.1 + 0.2)).toBe(30);
    expect(fromKurus(toKurus('14500.10'))).toBe(14500.1);
  });

  it('extracts VAT contained in a gross amount', () => {
    expect(includedVatKurus(12000, 20)).toBe(2000);
    expect(includedVatKurus(11000, 10)).toBe(1000);
  });
});

describe('i18n', () => {
  it('overlays non-empty translations only', () => {
    const entity = { name: 'Kırmızı', note: 'TR', translations: { en: { name: 'Red', note: '' } } };
    expect(localize(entity, 'en')).toEqual({ name: 'Red', note: 'TR' });
    expect(localize(entity, 'tr')).toEqual({ name: 'Kırmızı', note: 'TR' });
  });

  it('resolves Accept-Language style input', () => {
    expect(resolveLocale('en-US,en;q=0.9')).toBe('en');
    expect(resolveLocale('pt-BR,pt;q=0.9,ja;q=0.8')).toBe('ja');
    expect(resolveLocale('zh-CN')).toBe('zh');
    expect(resolveLocale('xx')).toBe('tr');
  });
});

describe('slugify', () => {
  it('handles Turkish characters', () => {
    expect(slugify('Çift Renk Çanta — İstinye')).toBe('cift-renk-canta-istinye');
    expect(slugify('  Şık Ürün Ğ ı  ')).toBe('sik-urun-g-i');
  });
});
