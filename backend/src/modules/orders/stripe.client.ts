import { BadRequestException, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { decrypt, encrypt, keyFromEnv } from '../../common/utils/crypto.util';
import { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';

/** Labels our sessions in the Stripe Dashboard (Stripe asks for an 8-letter random suffix). */
const INTEGRATION_ID = 'maeyja_web_checkout_qvtrkzpm';
/** Settings row holding the key pasted in the admin. Not a SettingKey, so /admin/settings never returns it. */
const ROW = 'stripeKeys';
const EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
];
export const STRIPE_KEY_PATTERN = /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/;

interface StoredKeys {
  secretKeyEnc: string;
  webhookSecretEnc: string | null;
  webhookId: string | null;
  keyHint: string;
  savedAt: string;
  savedById: string | null;
}

interface Active {
  client: Stripe;
  key: string;
  webhookSecret: string;
  source: 'admin' | 'env';
  hint: string;
  webhookId: string | null;
  savedAt: string | null;
}

/** "sk_live_…abcd": enough to recognise a key, useless to anyone who sees it. */
const hintOf = (key: string) => `${key.slice(0, key.indexOf('_', 3) + 1)}…${key.slice(-4)}`;

/**
 * Stripe Checkout (Stripe-hosted page). The key is pasted once in the admin (Ayarlar → Kartla ödeme): it is
 * checked against Stripe, the webhook is created with it, and both secrets are kept AES-GCM encrypted (KEY-01).
 * STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET in .env still work when nothing was saved in the admin.
 * Network trouble on Stripe's side becomes 503, so callers can tell "no answer" from "Stripe said no".
 */
@Injectable()
export class StripeClient implements OnModuleInit {
  private readonly logger = new Logger(StripeClient.name);
  private readonly encKey: Buffer;
  private active: Active | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    this.encKey = keyFromEnv(config.get('APP_ENCRYPTION_KEY', { infer: true }), config.get('JWT_ACCESS_SECRET', { infer: true }));
    // Payments are settled by the webhook too; without it a closed tab would leave a paid order unpaid.
    if (config.get('STRIPE_SECRET_KEY', { infer: true }) && this.isProd && !config.get('STRIPE_WEBHOOK_SECRET', { infer: true })) {
      throw new Error("STRIPE_WEBHOOK_SECRET prod'da zorunlu (ya da anahtarı admin → Ayarlar → Kartla ödeme'den girin)");
    }
  }

  async onModuleInit() {
    await this.load();
  }

  get configured() {
    return this.active !== null;
  }

  get testMode() {
    return /^(sk|rk)_test_/.test(this.active?.key ?? '');
  }

  /** For the admin: never the key itself. */
  status() {
    const a = this.active;
    return {
      configured: Boolean(a),
      source: a?.source ?? null,
      mode: a ? (this.testMode ? 'test' : 'live') : null,
      keyHint: a?.hint ?? null,
      webhook: Boolean(a?.webhookSecret),
      savedAt: a?.savedAt ?? null,
    };
  }

  /**
   * Checks a pasted key against Stripe, (re)creates our webhook endpoint with it and stores both secrets.
   * Local development (no public https API) skips the webhook; use `stripe listen` there.
   */
  async connect(secretKey: string, actorId: string | undefined) {
    const key = secretKey.trim();
    if (!STRIPE_KEY_PATTERN.test(key)) throw new BadRequestException('Bu bir Stripe gizli anahtarı değil (sk_live_… ya da rk_live_… ile başlar)');
    const client = this.make(key);

    const url = `${this.config.get('API_URL', { infer: true })}/${this.config.get('API_PREFIX', { infer: true })}/payments/stripe/webhook`;
    const publicUrl = url.startsWith('https://') && !/\/\/(localhost|127\.)/.test(url);
    let webhookId: string | null = null;
    let webhookSecret: string | null = null;
    try {
      const existing = await client.webhookEndpoints.list({ limit: 100 }); // also proves the key works
      if (publicUrl) {
        // Stripe shows a webhook's secret only once, at creation: replace the one we made before.
        for (const ep of existing.data.filter((e) => e.url === url && e.metadata?.maeyja === 'auto')) {
          await client.webhookEndpoints.del(ep.id);
        }
        const created = await client.webhookEndpoints.create({
          url,
          enabled_events: EVENTS,
          description: 'MAEYJA mağaza (admin panelinden otomatik)',
          metadata: { maeyja: 'auto' },
        });
        webhookId = created.id;
        webhookSecret = created.secret ?? null;
      }
    } catch (e) {
      throw this.keyError(e);
    }
    if (publicUrl && !webhookSecret) throw new BadRequestException('Stripe webhook oluşturulamadı, tekrar deneyin');
    if (!publicUrl) this.logger.warn(`API_URL is not public https (${url}): no webhook created, use \`stripe listen\` locally`);

    const value: StoredKeys = {
      secretKeyEnc: encrypt(key, this.encKey),
      webhookSecretEnc: webhookSecret ? encrypt(webhookSecret, this.encKey) : null,
      webhookId,
      keyHint: hintOf(key),
      savedAt: new Date().toISOString(),
      savedById: actorId ?? null,
    };
    const json = value as unknown as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({ where: { key: ROW }, create: { key: ROW, value: json }, update: { value: json } });
    await this.load();
    this.logger.log(`Stripe key saved (${value.keyHint}, webhook ${webhookId ? 'created' : 'skipped'})`);
    return this.status();
  }

  /** Forgets the admin key (and removes the webhook we created); .env keys, if any, take over again. */
  async disconnect() {
    const row = await this.prisma.setting.findUnique({ where: { key: ROW } });
    if (row && this.active?.source === 'admin' && this.active.webhookId) {
      await this.active.client.webhookEndpoints.del(this.active.webhookId).catch((e: Error) => this.logger.warn(`webhook not removed: ${e.message}`));
    }
    if (row) await this.prisma.setting.delete({ where: { key: ROW } });
    await this.load();
    return this.status();
  }

  createSession(params: Stripe.Checkout.SessionCreateParams, idempotencyKey: string) {
    return this.call((s) => s.checkout.sessions.create({ ...params, integration_identifier: INTEGRATION_ID }, { idempotencyKey }));
  }

  /** With the payment intent and its charge, for the card details and Radar's verdict. */
  retrieveSession(id: string) {
    return this.call((s) => s.checkout.sessions.retrieve(id, { expand: ['payment_intent.latest_charge'] }));
  }

  /** An expired session can't be paid any more — done before an unpaid order is cancelled. */
  expireSession(id: string) {
    return this.call((s) => s.checkout.sessions.expire(id));
  }

  /** A one-off coupon so the Stripe page shows our discount as its own line. */
  createCoupon(amountKurus: number, name: string, idempotencyKey: string) {
    return this.call((s) =>
      s.coupons.create({ amount_off: amountKurus, currency: 'try', duration: 'once', max_redemptions: 1, name: name.slice(0, 40) }, { idempotencyKey }),
    );
  }

  refund(paymentIntentId: string, idempotencyKey: string) {
    return this.call((s) => s.refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey }));
  }

  /** Throws unless the body carries a valid Stripe signature from the last 5 minutes. */
  parseWebhook(rawBody: Buffer | undefined, signature: string | undefined): Stripe.Event {
    const a = this.active;
    if (!a?.webhookSecret) throw new ServiceUnavailableException('Stripe webhook yapılandırılmamış');
    if (!rawBody || !signature) throw new BadRequestException('İmza yok');
    try {
      return a.client.webhooks.constructEvent(rawBody, signature, a.webhookSecret);
    } catch {
      throw new BadRequestException('Geçersiz imza');
    }
  }

  private get isProd() {
    return this.config.get('NODE_ENV', { infer: true }) === 'production';
  }

  private make(key: string) {
    return new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: 'MAEYJA' } });
  }

  /** Admin-saved key first, then .env. Called at start and after every change. */
  private async load() {
    const row = await this.prisma.setting.findUnique({ where: { key: ROW } });
    const stored = row?.value as StoredKeys | undefined;
    let next: Active | null = null;
    if (stored?.secretKeyEnc) {
      try {
        const key = decrypt(stored.secretKeyEnc, this.encKey);
        const webhookSecret = stored.webhookSecretEnc ? decrypt(stored.webhookSecretEnc, this.encKey) : this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
        next = { client: this.make(key), key, webhookSecret, source: 'admin', hint: stored.keyHint, webhookId: stored.webhookId, savedAt: stored.savedAt };
      } catch {
        // APP_ENCRYPTION_KEY changed since: the key has to be pasted again.
        this.logger.error('stored Stripe key could not be decrypted; paste it again in the admin');
      }
    }
    const envKey = this.config.get('STRIPE_SECRET_KEY', { infer: true });
    if (!next && envKey) {
      next = { client: this.make(envKey), key: envKey, webhookSecret: this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true }), source: 'env', hint: hintOf(envKey), webhookId: null, savedAt: null };
    }
    this.active = next;
    if (next && this.testMode) this.logger.warn('Stripe test mode: card payments move no real money');
  }

  /** What the admin sees when a pasted key doesn't work; Stripe's own text (with part of the key) stays in the log. */
  private keyError(e: unknown) {
    if (e instanceof Stripe.errors.StripeAuthenticationError) return new BadRequestException('Stripe bu anahtarı kabul etmedi; doğru anahtarı kopyaladığınızdan emin olun');
    if (e instanceof Stripe.errors.StripePermissionError) return new BadRequestException('Anahtarın webhook yetkisi yok; gizli anahtar (sk_…) kullanın ya da kısıtlı anahtara "Webhook Endpoints: Write" izni verin');
    if (e instanceof Stripe.errors.StripeError) {
      this.logger.warn(`Stripe refused key setup (${e.type}): ${e.message}`);
      return e instanceof Stripe.errors.StripeConnectionError || e instanceof Stripe.errors.StripeAPIError
        ? new ServiceUnavailableException('Stripe\'a ulaşılamadı, biraz sonra tekrar deneyin')
        : new BadRequestException('Stripe isteği reddetti; anahtarı ve hesabı kontrol edin');
    }
    return e;
  }

  private async call<T>(fn: (s: Stripe) => Promise<T>): Promise<T> {
    if (!this.active) throw new ServiceUnavailableException('Kartla ödeme yapılandırılmamış');
    try {
      return await fn(this.active.client);
    } catch (e) {
      if (e instanceof Stripe.errors.StripeConnectionError || e instanceof Stripe.errors.StripeAPIError || e instanceof Stripe.errors.StripeRateLimitError) {
        this.logger.error(`Stripe unreachable: ${e.message}`);
        throw new ServiceUnavailableException('Ödeme servisine ulaşılamadı, lütfen tekrar deneyin');
      }
      // A wrong or under-permitted key is ours to fix; its message (with part of the key) never reaches a shopper.
      if (e instanceof Stripe.errors.StripeAuthenticationError || e instanceof Stripe.errors.StripePermissionError) {
        this.logger.error(`Stripe key rejected: ${e.message}`);
        throw new ServiceUnavailableException('Kartla ödeme şu anda kullanılamıyor');
      }
      if (e instanceof Stripe.errors.StripeError) {
        this.logger.warn(`Stripe refused (${e.type}${e.code ? `/${e.code}` : ''}): ${e.message}`);
        throw new BadRequestException(`Stripe: ${e.message}`);
      }
      throw e;
    }
  }
}
