import { redact } from './audit.service';

describe('audit redaction (LOG-02)', () => {
  it('hides secrets at any depth and keeps the rest', () => {
    const out = redact({ name: 'Stripe', settings: { secretKey: 'sk_live_x', nested: [{ apiKey: 'k', label: 'ok' }] }, password: 'p' });
    expect(out).toEqual({ name: 'Stripe', settings: { secretKey: '***', nested: [{ apiKey: '***', label: 'ok' }] }, password: '***' });
  });
});
