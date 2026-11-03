import Stripe from 'stripe';
import { toKurus } from '../../common/utils/money.util';
import { CheckoutFormResult } from './iyzico.client';

/**
 * What a card provider's answer means for our records. Shared by the browser return, the webhook and
 * the expiry job, so every path decides the same way (EXT-04):
 * - paid: the money is ours and matches the order
 * - failed: nothing was charged
 * - review: money may have moved but something doesn't match (amount, signature, fraud check) → staff decide
 * - wait: no final answer yet (form still open, delayed payment method)
 */
export type Verdict =
  | { kind: 'paid'; providerPaymentId?: string; cardLast4?: string; cardAssociation?: string; installment?: number; raw: object; note: string }
  | { kind: 'failed'; reason: string; raw: object }
  | { kind: 'review'; reason: string; providerPaymentId?: string; raw: object }
  | { kind: 'wait' };

export interface ExpectedPayment {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  totalKurus: number;
}

/** Status values of the expanded payment intent that mean the attempt is over without money. */
const INTENT_FAILED: Stripe.PaymentIntent.Status[] = ['requires_payment_method', 'canceled'];

export function stripeVerdict(s: Stripe.Checkout.Session, expected: ExpectedPayment): Verdict {
  const intent = typeof s.payment_intent === 'object' ? s.payment_intent : null;
  const intentId = intent?.id ?? (typeof s.payment_intent === 'string' ? s.payment_intent : undefined);
  const charge = intent && typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
  // Only what the admin needs: no customer details from Stripe are stored.
  const raw = { session: s.id, status: s.status, paymentStatus: s.payment_status, intent: intentId, intentStatus: intent?.status, livemode: s.livemode };

  if (s.status === 'expired') return { kind: 'failed', reason: 'Stripe ödeme sayfasının süresi doldu', raw };
  if (s.status !== 'complete') return { kind: 'wait' };
  if (s.payment_status === 'unpaid') {
    return intent && INTENT_FAILED.includes(intent.status) ? { kind: 'failed', reason: `Stripe ödemesi başarısız (${intent.status})`, raw } : { kind: 'wait' };
  }

  // With Adaptive Pricing the shopper may pay in their own currency; our amount is the converted source.
  const currency = s.currency_conversion?.source_currency ?? s.currency;
  const amount = s.currency_conversion?.amount_total ?? s.amount_total;
  const mismatch =
    s.client_reference_id !== expected.paymentId || s.metadata?.paymentId !== expected.paymentId
      ? 'ödeme kimliği'
      : s.metadata?.orderId !== expected.orderId
        ? 'sipariş'
        : currency !== 'try'
          ? 'para birimi'
          : amount !== expected.totalKurus
            ? 'tutar'
            : null;
  if (mismatch) return { kind: 'review', reason: `Stripe ${mismatch} uyuşmuyor`, providerPaymentId: intentId, raw };
  if (charge?.outcome?.type === 'manual_review') return { kind: 'review', reason: 'Stripe Radar incelemesi', providerPaymentId: intentId, raw };

  const card = charge?.payment_method_details?.card;
  return {
    kind: 'paid',
    providerPaymentId: intentId,
    cardLast4: card?.last4 ?? undefined,
    cardAssociation: card?.brand?.toUpperCase(),
    raw,
    note: `Stripe ödeme ${intentId ?? s.id}${s.livemode ? '' : ' (TEST modu, gerçek para yok)'}`,
  };
}

export function iyzicoVerdict(r: CheckoutFormResult, signatureValid: boolean, expected: ExpectedPayment): Verdict {
  if (r.status !== 'success') return { kind: 'failed', reason: r.errorMessage ?? 'iyzico status failure', raw: r };
  if (r.paymentStatus !== 'SUCCESS') return { kind: 'failed', reason: `paymentStatus=${r.paymentStatus}`, raw: r };
  if (r.fraudStatus === -1) return { kind: 'failed', reason: 'fraud check rejected', raw: r };
  const mismatch = !signatureValid
    ? 'imza'
    : r.conversationId !== expected.paymentId
      ? 'conversationId'
      : r.basketId !== expected.orderNumber
        ? 'basketId'
        : r.currency !== 'TRY'
          ? 'para birimi'
          : // paidPrice may exceed price when the shopper picks an installment with interest.
            toKurus(r.price) !== expected.totalKurus || toKurus(r.paidPrice) < expected.totalKurus
            ? 'tutar'
            : null;
  if (mismatch) return { kind: 'review', reason: `iyzico ${mismatch} uyuşmuyor`, providerPaymentId: r.paymentId, raw: r };
  // fraudStatus 0: iyzico is still reviewing the payment; nothing ships until it says yes.
  if (r.fraudStatus === 0) return { kind: 'review', reason: 'iyzico fraud incelemesi', providerPaymentId: r.paymentId, raw: r };
  return {
    kind: 'paid',
    providerPaymentId: r.paymentId,
    cardLast4: r.lastFourDigits,
    cardAssociation: r.cardAssociation,
    installment: r.installment,
    raw: r,
    note: `iyzico ödeme ${r.paymentId}`,
  };
}
