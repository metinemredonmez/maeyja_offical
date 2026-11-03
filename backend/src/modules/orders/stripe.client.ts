import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Env } from '../../config/env.validation';

/** Labels our sessions in the Stripe Dashboard (Stripe asks for an 8-letter random suffix). */
const INTEGRATION_ID = 'maeyja_web_checkout_qvtrkzpm';

/**
 * Stripe Checkout (Stripe-hosted page). The key never leaves the API; a restricted key (rk_) with
 * Checkout Sessions, Coupons and Refunds write + PaymentIntents and Charges read is enough.
 * Network trouble on Stripe's side becomes 503, so callers can tell "no answer" from "Stripe said no".
 */
@Injectable()
export class StripeClient {
  private readonly logger = new Logger(StripeClient.name);
  private readonly client: Stripe | null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const key = config.get('STRIPE_SECRET_KEY', { infer: true });
    this.client = key ? new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: 'MAEYJA' } }) : null;
    // Payments are settled by the webhook too; without it a closed tab would leave a paid order unpaid.
    if (key && config.get('NODE_ENV', { infer: true }) === 'production' && !config.get('STRIPE_WEBHOOK_SECRET', { infer: true })) {
      throw new Error("STRIPE_WEBHOOK_SECRET prod'da zorunlu");
    }
    if (key && this.testMode) this.logger.warn('Stripe test mode: card payments move no real money');
  }

  get configured() {
    return this.client !== null;
  }

  get testMode() {
    return /^(sk|rk)_test_/.test(this.config.get('STRIPE_SECRET_KEY', { infer: true }));
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
    const secret = this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    if (!this.client || !secret) throw new ServiceUnavailableException('Stripe webhook yapılandırılmamış');
    if (!rawBody || !signature) throw new BadRequestException('İmza yok');
    try {
      return this.client.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException('Geçersiz imza');
    }
  }

  private async call<T>(fn: (s: Stripe) => Promise<T>): Promise<T> {
    if (!this.client) throw new ServiceUnavailableException('Kartla ödeme yapılandırılmamış');
    try {
      return await fn(this.client);
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
