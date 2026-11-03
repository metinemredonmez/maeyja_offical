import { createHmac } from 'crypto';
import Stripe from 'stripe';
import { CheckoutFormResult, IyzicoClient } from './iyzico.client';
import { iyzicoVerdict, stripeVerdict } from './payment-verdict';

const expected = { paymentId: 'pay_1', orderId: 'ord_1', orderNumber: 'MY-261103-1234', totalKurus: 1_250_050 };

const session = (over: Partial<Stripe.Checkout.Session> = {}) =>
  ({
    id: 'cs_1',
    status: 'complete',
    payment_status: 'paid',
    client_reference_id: 'pay_1',
    metadata: { paymentId: 'pay_1', orderId: 'ord_1' },
    currency: 'try',
    amount_total: 1_250_050,
    currency_conversion: null,
    livemode: true,
    payment_intent: {
      id: 'pi_1',
      status: 'succeeded',
      latest_charge: { outcome: { type: 'authorized' }, payment_method_details: { card: { last4: '4242', brand: 'visa' } } },
    },
    ...over,
  }) as unknown as Stripe.Checkout.Session;

describe('stripeVerdict', () => {
  it('accepts a paid session that matches the order', () => {
    const v = stripeVerdict(session(), expected);
    expect(v).toMatchObject({ kind: 'paid', providerPaymentId: 'pi_1', cardLast4: '4242', cardAssociation: 'VISA' });
  });

  it('sends a paid session with another amount to review, never to paid', () => {
    expect(stripeVerdict(session({ amount_total: 1_000 }), expected)).toMatchObject({ kind: 'review', providerPaymentId: 'pi_1' });
  });

  it('sends a session of another payment or order to review', () => {
    expect(stripeVerdict(session({ client_reference_id: 'pay_2' }), expected).kind).toBe('review');
    expect(stripeVerdict(session({ metadata: { paymentId: 'pay_1', orderId: 'ord_2' } }), expected).kind).toBe('review');
  });

  it('checks the TRY amount when the shopper paid in their own currency (Adaptive Pricing)', () => {
    const converted = { currency: 'eur', amount_total: 31_000, currency_conversion: { source_currency: 'try', amount_total: 1_250_050 } };
    expect(stripeVerdict(session(converted as Partial<Stripe.Checkout.Session>), expected).kind).toBe('paid');
  });

  it('holds a charge Radar wants reviewed', () => {
    const intent = { id: 'pi_1', status: 'succeeded', latest_charge: { outcome: { type: 'manual_review' } } };
    expect(stripeVerdict(session({ payment_intent: intent } as unknown as Partial<Stripe.Checkout.Session>), expected).kind).toBe('review');
  });

  it('waits on open pages and delayed payments, fails expired and declined ones', () => {
    expect(stripeVerdict(session({ status: 'open', payment_status: 'unpaid' }), expected).kind).toBe('wait');
    const processing = { payment_status: 'unpaid', payment_intent: { id: 'pi_1', status: 'processing', latest_charge: null } };
    expect(stripeVerdict(session(processing as unknown as Partial<Stripe.Checkout.Session>), expected).kind).toBe('wait');
    const declined = { payment_status: 'unpaid', payment_intent: { id: 'pi_1', status: 'requires_payment_method', latest_charge: null } };
    expect(stripeVerdict(session(declined as unknown as Partial<Stripe.Checkout.Session>), expected).kind).toBe('failed');
    expect(stripeVerdict(session({ status: 'expired', payment_status: 'unpaid' }), expected).kind).toBe('failed');
  });
});

describe('iyzico', () => {
  const secret = 'test-secret';
  const client = new IyzicoClient({ get: () => secret } as never);
  const result = (over: Partial<CheckoutFormResult> = {}): CheckoutFormResult => ({
    status: 'success',
    paymentStatus: 'SUCCESS',
    paymentId: '22416032',
    currency: 'TRY',
    basketId: expected.orderNumber,
    conversationId: 'pay_1',
    paidPrice: 12500.5,
    price: 12500.5,
    token: 'tok_1',
    fraudStatus: 1,
    ...over,
  });
  // Written out by hand from iyzico's documented order, prices without trailing zeros.
  const sign = (data: string) => createHmac('sha256', secret).update(data).digest('hex');

  it('validates the documented signature, with prices written without trailing zeros', () => {
    const r = result({ signature: sign(`SUCCESS:22416032:TRY:${expected.orderNumber}:pay_1:12500.5:12500.5:tok_1`) });
    expect(client.checkoutFormSignatureValid(r)).toBe(true);
    const whole = result({ paidPrice: '12500.00' as unknown as number, price: 12500, signature: sign(`SUCCESS:22416032:TRY:${expected.orderNumber}:pay_1:12500:12500:tok_1`) });
    expect(client.checkoutFormSignatureValid(whole)).toBe(true);
  });

  it('rejects a missing or tampered signature', () => {
    expect(client.checkoutFormSignatureValid(result())).toBe(false);
    const signed = sign(`SUCCESS:22416032:TRY:${expected.orderNumber}:pay_1:12500.5:12500.5:tok_1`);
    expect(client.checkoutFormSignatureValid(result({ paidPrice: 1, signature: signed }))).toBe(false);
  });

  it('maps answers: bad signature and fraud review go to review, declines to failed', () => {
    const exp = { ...expected, totalKurus: 1_250_050 };
    expect(iyzicoVerdict(result(), true, exp).kind).toBe('paid');
    expect(iyzicoVerdict(result(), false, exp).kind).toBe('review');
    expect(iyzicoVerdict(result({ fraudStatus: 0 }), true, exp).kind).toBe('review');
    expect(iyzicoVerdict(result({ fraudStatus: -1 }), true, exp).kind).toBe('failed');
    expect(iyzicoVerdict(result({ paymentStatus: 'FAILURE' }), true, exp).kind).toBe('failed');
    expect(iyzicoVerdict(result({ price: 100 }), true, exp).kind).toBe('review');
  });
});
