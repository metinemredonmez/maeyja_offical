'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Link, useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api.client';
import { money } from '@/lib/format';
import { attribution, savePendingPurchase, track, type TrackItem } from '@/lib/tracking';
import type { Address, CheckoutResult, PublicSettings, User } from '@/lib/types';
import { useCart, useCartMutations } from '@/components/cart/use-cart';

const phone = z.string().regex(/^[+\d\s()-]{10,20}$/);
const addressSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone,
  country: z.string().length(2).default('TR'),
  city: z.string().min(1).max(60),
  district: z.string().min(1).max(60),
  line1: z.string().min(5).max(200),
  line2: z.string().max(200).optional().or(z.literal('')),
  postalCode: z.string().max(12).optional().or(z.literal('')),
});

const schema = z
  .object({
    email: z.string().email().max(160),
    shippingAddressId: z.string().optional(),
    shippingAddress: addressSchema.optional(),
    billingSameAsShipping: z.boolean(),
    billingAddress: addressSchema.optional(),
    invoiceType: z.enum(['INDIVIDUAL', 'CORPORATE']),
    identityNumber: z.string().regex(/^\d{11}$/).optional().or(z.literal('')),
    companyName: z.string().max(160).optional().or(z.literal('')),
    taxOffice: z.string().max(80).optional().or(z.literal('')),
    taxNumber: z.string().regex(/^\d{10,11}$/).optional().or(z.literal('')),
    paymentMethod: z.enum(['IYZICO', 'BANK_TRANSFER']),
    customerNote: z.string().max(500).optional().or(z.literal('')),
    acceptTerms: z.literal(true),
    saveAddress: z.boolean().optional(),
    subscribeNewsletter: z.boolean().optional(),
  })
  .refine((v) => v.shippingAddressId || v.shippingAddress, { path: ['shippingAddress'] })
  .refine((v) => v.billingSameAsShipping || v.billingAddress, { path: ['billingAddress'] })
  .refine((v) => v.invoiceType === 'INDIVIDUAL' || (v.companyName && v.taxOffice && v.taxNumber), { path: ['companyName'] });

type Form = z.input<typeof schema>;

export function CheckoutForm({ user, addresses, settings }: { user: User | null; addresses: Address[]; settings: PublicSettings | null }) {
  const t = useTranslations('checkout');
  const tc = useTranslations('common');
  const tcart = useTranslations('cart');
  const locale = useLocale();
  const router = useRouter();
  const { data: cart } = useCart();
  const { invalidate } = useCartMutations();
  const [bank, setBank] = useState<CheckoutResult['payment'] | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const ta = useTranslations('auth');
  const guestAllowed = settings?.checkout.guestCheckout ?? true;
  const bankEnabled = settings?.bankTransfer.enabled ?? false;

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: user?.email ?? '',
      shippingAddressId: addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id,
      billingSameAsShipping: true,
      invoiceType: 'INDIVIDUAL',
      paymentMethod: 'IYZICO',
      saveAddress: Boolean(user),
      country: 'TR',
    } as Partial<Form>,
  });
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = form;
  const addressId = watch('shippingAddressId');
  const billingSame = watch('billingSameAsShipping');
  const invoiceType = watch('invoiceType');
  const paymentMethod = watch('paymentMethod');

  // Ad pixels: the start of checkout, once the bag has loaded.
  const lines: TrackItem[] = (cart?.lines ?? []).map((l) => ({ id: l.sku, name: l.productName, variant: l.colorName, price: l.unitPrice, quantity: l.quantity }));
  const hasCart = Boolean(cart?.lines.length);
  useEffect(() => {
    if (hasCart) track('begin_checkout', { value: cart!.total, items: lines });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the bag is there
  }, [hasCart]);

  const onSubmit = async (v: Form) => {
    const body = {
      email: v.email,
      shippingAddressId: v.shippingAddressId || undefined,
      shippingAddress: v.shippingAddressId ? undefined : v.shippingAddress,
      billingSameAsShipping: v.billingSameAsShipping,
      billingAddress: v.billingSameAsShipping ? undefined : v.billingAddress,
      invoice: { type: v.invoiceType, identityNumber: v.identityNumber || undefined, companyName: v.companyName || undefined, taxOffice: v.taxOffice || undefined, taxNumber: v.taxNumber || undefined },
      paymentMethod: v.paymentMethod,
      customerNote: v.customerNote || undefined,
      acceptTerms: true,
      saveAddress: v.saveAddress,
      subscribeNewsletter: v.subscribeNewsletter,
      // Lets the server send the same Purchase to Meta/Google — only with cookie consent.
      attribution: attribution(),
    };
    try {
      const result = await api.post<CheckoutResult>('/checkout', body, locale);
      if (cart) savePendingPurchase(result.order.orderNumber, cart.total, lines);
      invalidate(); // the API emptied the cart
      if (result.payment?.paymentPageUrl) {
        window.location.assign(result.payment.paymentPageUrl); // iyzico hosted page (3-D Secure)
        return;
      }
      if (result.payment?.provider === 'BANK_TRANSFER') {
        setBank(result.payment);
        setOrderNumber(result.order.orderNumber);
        return;
      }
      router.push(`/checkout/result?order=${result.order.orderNumber}&status=success` as never);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : tc('error'));
    }
  };

  if (bank?.bankTransfer) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-serif text-4xl font-light">{t('resultSuccess')}</h1>
        <p className="mt-3 text-[15px] text-ink-soft">{t('resultSuccessText', { orderNumber })}</p>
        <div className="mt-10 border border-line p-6 text-left text-sm">
          <p className="label mb-4 text-muted">{t('bankDetails')}</p>
          <p>{bank.bankTransfer.bankName}</p>
          <p>{bank.bankTransfer.accountName}</p>
          <p className="mt-2 font-mono text-base">{bank.bankTransfer.iban}</p>
          <p className="mt-4 text-muted">{bank.bankTransfer.note || t('bankNote')}</p>
          <p className="mt-1 text-muted">{t('bankTransferHint')}</p>
        </div>
        <Link href={user ? `/account/orders/${orderNumber}` : `/order-status?order=${orderNumber}`} className="btn-outline mt-10">
          {t('trackOrder')}
        </Link>
      </div>
    );
  }

  if (!user && !guestAllowed) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-[15px]">{t('guestDisabled')}</p>
        <Link href="/account/login?next=/checkout" className="btn-primary mt-8">
          {ta('login')}
        </Link>
      </div>
    );
  }

  const empty = !cart || cart.lines.length === 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-12 px-4 pt-12 md:grid-cols-12 md:px-12 md:pt-20" noValidate>
      <div className="flex flex-col gap-12 md:col-span-7">
        <h1 className="font-serif text-5xl font-light leading-none md:text-[56px]">{t('title')}</h1>

        <Section title={t('contact')}>
          {!user ? (
            <p className="text-sm text-muted">
              {t.rich('loginHint', { a: (c) => <Link href="/account/login?next=/checkout" className="underline underline-offset-4 hover:text-brand">{c}</Link> })}
            </p>
          ) : null}
          <Input label={tc('email')} type="email" autoComplete="email" error={errors.email} {...register('email')} readOnly={Boolean(user)} />
        </Section>

        <Section title={t('shippingAddress')}>
          {addresses.length ? (
            <div className="flex flex-col gap-2">
              {addresses.map((a) => (
                <label key={a.id} className={`flex cursor-pointer gap-3 border p-4 text-sm ${addressId === a.id ? 'border-ink' : 'border-line'}`}>
                  <input type="radio" value={a.id} {...register('shippingAddressId')} className="mt-1 accent-ink" />
                  <span>
                    <span className="label block text-muted">{a.title ?? `${a.firstName} ${a.lastName}`}</span>
                    {a.line1} {a.line2}, {a.district} / {a.city} · {a.phone}
                  </span>
                </label>
              ))}
              <label className={`flex cursor-pointer gap-3 border p-4 text-sm ${!addressId ? 'border-ink' : 'border-line'}`}>
                <input type="radio" value="" {...register('shippingAddressId')} className="accent-ink" />
                {t('newAddress')}
              </label>
            </div>
          ) : null}
          {!addressId ? <AddressFields prefix="shippingAddress" register={register} errors={errors.shippingAddress} /> : null}
          {user && !addressId ? <Check label={t('saveAddress')} {...register('saveAddress')} /> : null}
        </Section>

        <Section title={t('billing')}>
          <div className="flex gap-6">
            {(['INDIVIDUAL', 'CORPORATE'] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input type="radio" value={v} {...register('invoiceType')} className="accent-ink" />
                {v === 'INDIVIDUAL' ? t('invoiceIndividual') : t('invoiceCorporate')}
              </label>
            ))}
          </div>
          {invoiceType === 'CORPORATE' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t('companyName')} error={errors.companyName} {...register('companyName')} />
              <Input label={t('taxOffice')} error={errors.taxOffice} {...register('taxOffice')} />
              <Input label={t('taxNumber')} inputMode="numeric" error={errors.taxNumber} {...register('taxNumber')} />
            </div>
          ) : (
            <Input label={t('identityNumber')} inputMode="numeric" maxLength={11} error={errors.identityNumber} {...register('identityNumber')} />
          )}
          <Check label={t('billingSame')} {...register('billingSameAsShipping')} />
          {!billingSame ? <AddressFields prefix="billingAddress" register={register} errors={errors.billingAddress} /> : null}
        </Section>

        <Section title={t('payment')}>
          <label className={`flex cursor-pointer flex-col gap-1 border p-4 ${paymentMethod === 'IYZICO' ? 'border-ink' : 'border-line'}`}>
            <span className="flex items-center gap-3 text-sm">
              <input type="radio" value="IYZICO" {...register('paymentMethod')} className="accent-ink" />
              {t('card')}
            </span>
            <span className="pl-7 text-xs text-muted">{t('cardHint')}</span>
          </label>
          {bankEnabled ? (
            <label className={`flex cursor-pointer flex-col gap-1 border p-4 ${paymentMethod === 'BANK_TRANSFER' ? 'border-ink' : 'border-line'}`}>
              <span className="flex items-center gap-3 text-sm">
                <input type="radio" value="BANK_TRANSFER" {...register('paymentMethod')} className="accent-ink" />
                {t('bankTransfer')}
              </span>
              <span className="pl-7 text-xs text-muted">{t('bankTransferHint')}</span>
            </label>
          ) : null}
          <label className="flex flex-col gap-2">
            <span className="label text-muted">{t('note')}</span>
            <textarea rows={3} maxLength={500} {...register('customerNote')} className="field" />
          </label>
        </Section>

        <Section title="">
          <Check
            error={errors.acceptTerms}
            label={t.rich('terms', {
              a: (c) => <Link href="/distance-sales-agreement" target="_blank" className="underline underline-offset-4">{c}</Link>,
              b: (c) => <Link href="/preliminary-information" target="_blank" className="underline underline-offset-4">{c}</Link>,
            })}
            {...register('acceptTerms')}
          />
          {!user?.marketingOptIn ? <Check label={t('newsletter')} {...register('subscribeNewsletter')} /> : null}
        </Section>
      </div>

      <aside className="md:col-span-4 md:col-start-9">
        <div className="flex flex-col gap-6 border border-line p-6 md:sticky md:top-28">
          <h2 className="label text-muted">{t('summary')}</h2>
          {empty ? (
            <p className="text-sm text-muted">{tcart('empty')}</p>
          ) : (
            <>
              <ul className="flex flex-col gap-3 text-sm">
                {cart.lines.map((l) => (
                  <li key={l.variantId} className="flex justify-between gap-3">
                    <span>
                      {l.productName}
                      {l.variantName ? <span className="text-muted"> · {l.variantName}</span> : null} × {l.quantity}
                    </span>
                    <span>{money(l.lineTotal, locale)}</span>
                  </li>
                ))}
              </ul>
              <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
                <div className="flex justify-between"><dt>{tcart('subtotal')}</dt><dd>{money(cart.subtotal, locale)}</dd></div>
                {cart.discountTotal > 0 ? <div className="flex justify-between"><dt>{tcart('discount')} ({cart.coupon?.code})</dt><dd>−{money(cart.discountTotal, locale)}</dd></div> : null}
                <div className="flex justify-between"><dt>{tcart('shipping')}</dt><dd>{cart.shippingTotal > 0 ? money(cart.shippingTotal, locale) : tc('free')}</dd></div>
                <div className="flex justify-between border-t border-line pt-3 text-base"><dt>{tcart('total')}</dt><dd>{money(cart.total, locale)}</dd></div>
                <p className="text-xs text-muted">{tcart('tax')}: {money(cart.taxTotal, locale)}</p>
              </dl>
              <button type="submit" disabled={isSubmitting || !cart.allAvailable} className="btn-primary w-full">
                {isSubmitting ? t('placing') : t('placeOrder')}
              </button>
            </>
          )}
        </div>
      </aside>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      {title ? <h2 className="font-serif text-2xl">{title}</h2> : null}
      {children}
    </section>
  );
}

type Reg = ReturnType<typeof useForm<Form>>['register'];
type FieldErr = { message?: string } | undefined;

function AddressFields({ prefix, register, errors }: { prefix: 'shippingAddress' | 'billingAddress'; register: Reg; errors: unknown }) {
  const t = useTranslations('checkout');
  const tc = useTranslations('common');
  const e = (errors ?? {}) as Record<string, FieldErr>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label={tc('firstName')} autoComplete="given-name" error={e.firstName} {...register(`${prefix}.firstName`)} />
      <Input label={tc('lastName')} autoComplete="family-name" error={e.lastName} {...register(`${prefix}.lastName`)} />
      <Input label={tc('phone')} type="tel" autoComplete="tel" error={e.phone} {...register(`${prefix}.phone`)} />
      <Input label={t('country')} autoComplete="country" defaultValue="TR" maxLength={2} error={e.country} {...register(`${prefix}.country`)} />
      <Input label={t('city')} autoComplete="address-level1" error={e.city} {...register(`${prefix}.city`)} />
      <Input label={t('district')} autoComplete="address-level2" error={e.district} {...register(`${prefix}.district`)} />
      <div className="sm:col-span-2"><Input label={t('line1')} autoComplete="address-line1" error={e.line1} {...register(`${prefix}.line1`)} /></div>
      <Input label={t('line2')} autoComplete="address-line2" error={e.line2} {...register(`${prefix}.line2`)} />
      <Input label={t('postalCode')} autoComplete="postal-code" error={e.postalCode} {...register(`${prefix}.postalCode`)} />
    </div>
  );
}

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: FieldErr }>(function Input({ label, error, className, ...rest }, ref) {
  return (
    <label className="flex flex-col gap-2">
      <span className="label text-muted">{label}</span>
      <input ref={ref} {...rest} aria-invalid={Boolean(error)} className={`field ${error ? 'border-brand' : ''} ${className ?? ''}`} />
      {error?.message ? <span className="text-xs text-brand">{error.message}</span> : null}
    </label>
  );
});

export const Check = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: FieldErr }>(function Check({ label, error, ...rest }, ref) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input ref={ref} type="checkbox" {...rest} className={`mt-0.5 h-4 w-4 accent-ink ${error ? 'outline outline-1 outline-brand' : ''}`} />
      <span>{label}</span>
    </label>
  );
});
