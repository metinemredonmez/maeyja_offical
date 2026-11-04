import { Logger } from '@nestjs/common';
import { maskEmail, maskEmails, webhookAllowed } from './alert-catalog';
import { AlertsService } from './alerts.service';

Logger.overrideLogger(false);

function setup(opts: { claim?: number; dbDown?: boolean; muted?: string[] } = {}) {
  const prisma = {
    alert: {
      upsert: jest.fn(async () => {
        if (opts.dbDown) throw new Error('db down');
        return { id: 'a1', key: '', title: 'x', detail: 'x', count: 1, firstAt: new Date(), level: 'WARNING' };
      }),
      updateMany: jest.fn(async () => ({ count: opts.claim ?? 1 })),
    },
  };
  const settings = {
    get: jest.fn(async () => {
      if (opts.dbDown) throw new Error('db down');
      return { email: '', webhookUrl: '', muted: opts.muted ?? [] };
    }),
  };
  const mail = { send: jest.fn(async () => true), onFailure: jest.fn(), enabled: true };
  const env: Record<string, string> = { ADMIN_NOTIFY_EMAIL: 'owner@shop.test', ADMIN_URL: 'https://admin.shop.test' };
  const config = { get: (k: string) => env[k] };
  const svc = new AlertsService(prisma as never, settings as never, mail as never, config as never);
  return { svc, prisma, mail };
}

describe('alert webhook allow-list (EXT-01/02)', () => {
  it('accepts the chat services over https', () => {
    expect(webhookAllowed('https://hooks.slack.com/services/T0/B0/abc')).toBe(true);
    expect(webhookAllowed('https://discord.com/api/webhooks/1/abc')).toBe(true);
  });

  it('refuses anything else', () => {
    for (const url of [
      'http://hooks.slack.com/services/x',
      'https://hooks.slack.com.evil.example/x',
      'https://evil.example/hooks.slack.com',
      'https://hooks.slack.com:8443/x',
      'https://user:pw@hooks.slack.com/x',
      'https://127.0.0.1/x',
      'not a url',
    ]) {
      expect(webhookAllowed(url)).toBe(false);
    }
  });
});

describe('alert masking (LOG-02)', () => {
  it('keeps only enough of an address to recognise it', () => {
    expect(maskEmail('canan@shop.test')).toBe('c***@shop.test');
    expect(maskEmails('550 <john.doe@x.example> rejected')).toBe('550 <j***@x.example> rejected');
  });
});

describe('AlertsService (LOG-04)', () => {
  it('stores a warning and mails it once, with addresses masked', async () => {
    const { svc, prisma, mail } = setup();
    await svc.raise('mail.send_failed', 'to john@x.example: 550');
    expect(prisma.alert.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.alert.upsert.mock.calls[0]).toEqual([expect.objectContaining({ create: expect.objectContaining({ detail: 'to j***@x.example: 550' }) })]);
    expect(mail.send).toHaveBeenCalledTimes(1);
    // The alert e-mail itself never reports its own failure (no alert loop).
    expect(mail.send.mock.calls[0]).toEqual(['owner@shop.test', expect.anything(), false]);
  });

  it('stays quiet for a repeat inside the window', async () => {
    const { svc, prisma, mail } = setup({ claim: 0 });
    await svc.raise('payment.review', 'MY-1: review', { key: 'MY-1' });
    expect(prisma.alert.upsert).toHaveBeenCalledTimes(1);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('keeps INFO alerts in the panel only', async () => {
    const { svc, prisma, mail } = setup();
    await svc.raise('security.ip_locked', '203.0.113.9 locked', { key: '203.0.113.9' });
    expect(prisma.alert.updateMany).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('records but does not send a muted code', async () => {
    const { svc, prisma, mail } = setup({ muted: ['quota.warning'] });
    await svc.raise('quota.warning', '80 %', { key: 'chat' });
    expect(prisma.alert.upsert).toHaveBeenCalledTimes(1);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('never throws while the database is down, mails once and writes the alert later', async () => {
    const { svc, prisma, mail } = setup({ dbDown: true });
    await expect(svc.raise('payment.webhook_failed', 'first')).resolves.toBeUndefined();
    await svc.raise('payment.webhook_failed', 'second');
    expect(mail.send).toHaveBeenCalledTimes(1);

    prisma.alert.upsert.mockImplementation(async () => ({ id: 'a1', key: '', title: 'x', detail: 'x', count: 1, firstAt: new Date(), level: 'CRITICAL' }));
    await svc.flush();
    expect(prisma.alert.upsert).toHaveBeenCalledTimes(4); // two failed tries, then both buffered raises
  });
});
