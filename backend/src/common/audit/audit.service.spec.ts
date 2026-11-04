import { redact } from './audit.service';

describe('audit redaction (LOG-02)', () => {
  it('hides secrets at any depth and keeps the rest', () => {
    const out = redact({ name: 'Stripe', settings: { secretKey: 'sk_live_x', nested: [{ apiKey: 'k', label: 'ok' }] }, password: 'p' });
    expect(out).toEqual({ name: 'Stripe', settings: { secretKey: '***', nested: [{ apiKey: '***', label: 'ok' }] }, password: '***' });
  });

  it('hides an alert webhook address (its URL alone lets anyone post to the channel)', () => {
    expect(redact({ email: 'a@b.co', webhookUrl: 'https://hooks.slack.com/services/x' })).toEqual({ email: 'a@b.co', webhookUrl: '***' });
  });
});
