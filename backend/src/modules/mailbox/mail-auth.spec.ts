import { senderVerified } from './mail-auth';

const ar = (line: string) => ({ key: 'authentication-results', line: `Authentication-Results: ${line}` });

describe('sender verification (AI-01)', () => {
  it('trusts DMARC or an aligned DKIM pass in the topmost header', () => {
    expect(senderVerified([ar('mx.example.net; spf=pass smtp.mailfrom=shop.com; dmarc=pass (p=NONE) header.from=gmail.com')], 'ayse@gmail.com')).toBe(true);
    expect(senderVerified([ar('mx.example.net;\r\n dkim=pass header.i=@mail.firma.com.tr header.s=s1')], 'info@firma.com.tr')).toBe(true);
  });

  it('refuses a failed, unaligned or lower (sender-made) result', () => {
    expect(senderVerified([ar('mx.example.net; dmarc=fail header.from=gmail.com')], 'ayse@gmail.com')).toBe(false);
    expect(senderVerified([ar('mx.example.net; dkim=pass header.d=attacker.com')], 'ayse@gmail.com')).toBe(false);
    expect(senderVerified([ar('mx.example.net; dmarc=none'), ar('forged; dmarc=pass header.from=gmail.com')], 'ayse@gmail.com')).toBe(false);
    expect(senderVerified([], 'ayse@gmail.com')).toBe(false);
  });
});
