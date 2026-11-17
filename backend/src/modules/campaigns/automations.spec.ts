import { Logger } from '@nestjs/common';
import { fillBody, renderAutomation } from './automation.mail';
import { MailAutomationsService } from './automations.service';

Logger.overrideLogger(false);

describe('automatic e-mail texts', () => {
  it('fills the name and coupon, drops a coupon paragraph without a code, and escapes everything', () => {
    expect(fillBody('Merhaba{name},\n\nKod: {coupon}\n\nGörüşmek üzere', { name: 'Ayşe', coupon: 'SIZE10' })).toBe('<p>Merhaba Ayşe,</p><p>Kod: SIZE10</p><p>Görüşmek üzere</p>');
    expect(fillBody('Merhaba{name},\n\nKod: {coupon}', { name: null, coupon: null })).toBe('<p>Merhaba,</p>');
    expect(fillBody('<script>x</script>{name}', { name: '<b>' })).toBe('<p>&lt;script&gt;x&lt;/script&gt; &lt;b&gt;</p>');
  });

  it('renders the shop frame with a button and an unsubscribe link, in English for other languages', () => {
    const texts = { subject: { tr: 'Hoş geldiniz', en: 'Welcome' }, body: { tr: 'Merhaba', en: 'Hello{name}' } };
    const opts = { locale: 'de', unsubscribeUrl: 'https://shop.test/de/unsubscribe?r=a_1&t=x', webUrl: 'https://shop.test', sender: { name: 'MAEYJA', address: '', email: '' } };
    const mail = renderAutomation('welcome', texts, { name: 'Anna' }, opts);
    expect(mail.subject).toBe('Welcome');
    expect(mail.html).toContain('Hello Anna');
    expect(mail.html).toContain('https://shop.test/de/products');
    expect(mail.text).toContain('https://shop.test/de/unsubscribe?r=a_1&t=x');
  });
});

describe('MailAutomationsService', () => {
  const flows = {
    mailWelcome: { enabled: true, subject: { tr: 'Hoş geldiniz' }, body: { tr: 'Merhaba{name}' } },
    mailAfterPurchase: { enabled: false, delayDays: 10, onlyConsented: true, subject: {}, body: {} },
    mailWinback: { enabled: false, afterDays: 180, coupon: '', subject: {}, body: {} },
    store: { name: 'MAEYJA', address: '', email: '' },
  };

  function setup(opts: { smtp?: boolean; settings?: Record<string, object>; subscribers?: object[]; unsubscribed?: string[]; coupon?: object | null } = {}) {
    const created: object[] = [];
    const prisma = {
      setting: { findUnique: jest.fn(async () => null), upsert: jest.fn(async () => ({})) },
      newsletterSubscriber: {
        findMany: jest.fn(async (q: { where: { unsubscribedAt: unknown } }) =>
          q.where.unsubscribedAt === null ? (opts.subscribers ?? []) : (opts.unsubscribed ?? []).map((email) => ({ email })),
        ),
      },
      user: { findMany: jest.fn(async () => []) },
      mailAutomationSend: {
        findMany: jest.fn(async () => []),
        create: jest.fn(async (q: { data: object }) => (created.push(q.data), { id: `s${created.length}` })),
        update: jest.fn(async () => ({})),
      },
      coupon: { findFirst: jest.fn(async () => opts.coupon ?? null) },
    };
    const all = { ...flows, ...(opts.settings ?? {}) } as Record<string, object>;
    const settings = { get: jest.fn(async (k: string) => all[k]) };
    const mail = { enabled: opts.smtp ?? true, deliver: jest.fn(async () => undefined) };
    const usage = { mailToday: jest.fn(async () => true), take: jest.fn(async () => true) };
    const alerts = { raise: jest.fn(async () => undefined) };
    const env: Record<string, string> = { APP_ENCRYPTION_KEY: '', JWT_ACCESS_SECRET: 'x'.repeat(32), WEB_URL: 'https://shop.test', API_URL: 'https://api.shop.test', API_PREFIX: 'api' };
    const svc = new MailAutomationsService(prisma as never, mail as never, settings as never, usage as never, alerts as never, { get: (k: string) => env[k] } as never);
    return { svc, prisma, mail, alerts, created };
  }

  it('does nothing at all without SMTP', async () => {
    const { svc, prisma } = setup({ smtp: false });
    await expect(svc.run()).resolves.toEqual({ skipped: 'smtp' });
    expect(prisma.newsletterSubscriber.findMany).not.toHaveBeenCalled();
  });

  it('welcomes new subscribers once, never one who unsubscribed, with a signed unsubscribe header', async () => {
    const { svc, mail, created } = setup({
      subscribers: [
        { email: 'a@shop.test', locale: 'tr' },
        { email: 'b@shop.test', locale: 'en' },
      ],
      unsubscribed: ['b@shop.test'],
    });
    await expect(svc.run()).resolves.toMatchObject({ welcome: 1, failed: 0 });
    expect(created).toEqual([{ flow: 'welcome', email: 'a@shop.test', refId: '', locale: 'tr' }]);
    expect(mail.deliver).toHaveBeenCalledWith('a@shop.test', expect.objectContaining({ subject: 'Hoş geldiniz' }), expect.objectContaining({ 'List-Unsubscribe': expect.stringContaining('r=a_s1&t=') }));
  });

  it('holds the win-back e-mail and alerts staff when its coupon is not valid', async () => {
    const { svc, alerts, prisma } = setup({ settings: { mailWelcome: { ...flows.mailWelcome, enabled: false }, mailWinback: { ...flows.mailWinback, enabled: true, coupon: 'OLD10' } } });
    await svc.run();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(alerts.raise).toHaveBeenCalledWith('campaign.stopped', expect.stringContaining('OLD10'), { key: 'winback-coupon' });
  });
});
