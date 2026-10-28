'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api.client';
import { money } from '@/lib/format';
import type { Product, PublicSettings } from '@/lib/types';
import { useCartMutations } from '@/components/cart/use-cart';
import { useCartUi } from '@/components/cart/cart-ui';
import { Gallery } from './gallery';
import { Swatch } from './swatch';
import { Accordion } from './accordion';

/** Owns the colour/size selection so the gallery and the sticky box stay in sync. */
export function BuyBox({ product, shipping }: { product: Product; shipping: PublicSettings['shipping'] | null }) {
  const t = useTranslations('product');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { add } = useCartMutations();
  const { openCart } = useCartUi();

  const colors = product.colors;
  const sizes = product.sizes;
  const [color, setColor] = useState<string | null>(colors.find((c) => c.inStock)?.slug ?? colors[0]?.slug ?? null);
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null);

  const variant = useMemo(
    () => product.variants.find((v) => (v.color?.slug ?? null) === color && (v.size ?? null) === (sizes.length ? size : null)) ?? null,
    [product.variants, color, size, sizes.length],
  );
  const price = variant?.price ?? product.priceRange?.min ?? product.basePrice;
  const compareAt = variant?.compareAtPrice ?? product.compareAtPrice;
  const needsSize = sizes.length > 0 && !size;
  const soldOut = Boolean(variant && !variant.inStock);

  const addToCart = () => {
    if (!variant) return;
    add.mutate(
      { variantId: variant.id, quantity: 1 },
      {
        onSuccess: () => {
          toast.success(t('added'));
          openCart();
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : tc('error')),
      },
    );
  };

  const sizeAvailable = (s: string) => product.variants.some((v) => v.size === s && (v.color?.slug ?? null) === color && v.inStock);

  return (
    <div className="grid gap-10 md:grid-cols-12 md:gap-6">
      <div className="md:col-span-7">
        <Gallery images={product.images} colorSlug={color} name={product.name} />
      </div>

      <div className="md:col-span-4 md:col-start-9">
        <div className="flex flex-col gap-6 md:sticky md:top-28">
          <div className="flex flex-col gap-2">
            {product.collections[0] ? <p className="label text-muted">{product.collections[0].name}{variant?.color ? ` · ${variant.color.name}` : ''}</p> : null}
            <h1 className="font-serif text-4xl font-normal leading-tight md:text-[44px]">{product.name}</h1>
            {product.subtitle ? <p className="text-sm text-muted">{product.subtitle}</p> : null}
          </div>

          <p className="text-lg">
            {money(price, locale)}
            {compareAt && compareAt > price ? <span className="ml-3 text-sm text-muted line-through">{money(compareAt, locale)}</span> : null}
          </p>

          {colors.length ? (
            <div className="flex flex-col gap-3">
              <p className="label text-muted">
                {t('color')} — {colors.find((c) => c.slug === color)?.name}
              </p>
              <div className="flex flex-wrap gap-3">
                {colors.map((c) => (
                  <button key={c.slug} type="button" aria-label={c.name} aria-pressed={c.slug === color} onClick={() => setColor(c.slug)} className={`rounded-full p-0.5 ${!c.inStock ? 'opacity-40' : ''}`}>
                    <Swatch hex={c.hex} hex2={c.hex2} size={30} selected={c.slug === color} />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {sizes.length ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="label text-muted">{t('size')}</p>
                {product.sizeGuide ? <span className="label text-muted">{t('sizeGuide')}</span> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button key={s} type="button" aria-pressed={s === size} onClick={() => setSize(s)} className={`min-w-12 border px-3 py-2.5 text-sm ${s === size ? 'border-ink bg-ink text-ground' : 'border-line hover:border-ink'} ${!sizeAvailable(s) ? 'text-muted line-through' : ''}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {soldOut ? (
            <StockAlert variantId={variant!.id} />
          ) : (
            <button type="button" onClick={addToCart} disabled={needsSize || !variant || add.isPending} className="btn-primary w-full justify-between px-6">
              <span>{needsSize ? t('selectSize') : t('addToCart')}</span>
              <span className="text-[13px] tracking-[0.04em]">{money(price, locale)}</span>
            </button>
          )}
          {variant?.lowStock ? <p className="text-xs text-brand">{tc('lowStock', { count: 3 })}</p> : null}

          <ul className="flex flex-col gap-2 border-t border-line pt-4 text-xs text-muted">
            <li>{t('perks.shipping', { days: shipping?.estimatedDays ?? '1-3' })}</li>
            <li>{t('perks.returns')}</li>
            <li>{t('perks.installments')}</li>
            <li>{t('perks.gift')}</li>
          </ul>

          <Accordion
            items={[
              { title: t('details'), body: product.description, open: true },
              { title: t('materialCare'), body: [product.material, product.care].filter(Boolean).join('\n\n') },
              { title: t('dimensions'), body: product.dimensions },
              { title: t('shippingReturns'), body: `${t('perks.shipping', { days: shipping?.estimatedDays ?? '1-3' })}\n${t('perks.returns')}` },
              { title: t('atelier'), body: [product.story, product.madeIn ? `${t('madeIn')}: ${product.madeIn}` : null].filter(Boolean).join('\n\n') },
            ].filter((i) => i.body)}
          />
        </div>
      </div>
    </div>
  );
}

function StockAlert({ variantId }: { variantId: string }) {
  const t = useTranslations('product');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/catalog/stock-alerts', { variantId, email, locale });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '');
    }
  };
  if (done) return <p className="text-sm text-muted">{t('notifySent')}</p>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-brand">{t('notifyText')}</p>
      <div className="flex">
        <label htmlFor="stock-alert" className="sr-only">
          E-mail
        </label>
        <input id="stock-alert" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field border-r-0" placeholder="you@example.com" />
        <button type="submit" className="btn-primary shrink-0 px-5">
          {t('notifyMe')}
        </button>
      </div>
    </form>
  );
}
