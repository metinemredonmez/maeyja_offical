'use client';

import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api.client';
import { modelNo, money } from '@/lib/format';
import { track } from '@/lib/tracking';
import type { Product, PublicSettings } from '@/lib/types';
import { useCartMutations } from '@/components/cart/use-cart';
import { useCartUi } from '@/components/cart/cart-ui';
import { Gallery } from './gallery';
import { Swatch } from './swatch';
import { ProductTabs } from './product-tabs';
import { WishlistButton } from './wishlist-button';
import { TryOn } from './try-on';

/**
 * Polène-style product view. Left half: the photos of the selected colour stacked. Right half (sticky): name,
 * model number and colour, price, the bag large on the cream ground, colours picked by their own photo,
 * "Add to bag" + wishlist, and tabs. Owns the colour/size selection so both halves stay in sync.
 * Cut-out photos sit on an explicit cream fill: the sticky panel is its own stacking context, so "multiply"
 * would otherwise blend against nothing and keep the white studio background.
 */
export function BuyBox({ product, shipping, wishlisted, crumb, tryon = false }: { product: Product; shipping: PublicSettings['shipping'] | null; wishlisted: boolean; crumb: ReactNode; tryon?: boolean }) {
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

  // Photos tagged with a colour show only for that colour; untagged ones always show.
  const forColor = product.images.filter((i) => !i.colorSlug || i.colorSlug === color);
  const photos = forColor.length ? forColor : product.images;
  const lead = photos[0];
  const stacked = photos.length > 1 ? photos.slice(1) : photos;
  const thumbFor = (slug: string) => product.images.find((i) => i.colorSlug === slug);
  const colorName = colors.find((c) => c.slug === color)?.name;

  // Ad pixels: the product view once per product, and each add to bag.
  useEffect(() => {
    track('view_item', { value: price, items: [{ id: product.variants[0]?.sku ?? product.slug, name: product.name, price, quantity: 1 }] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per product
  }, [product.slug]);

  const addToCart = () => {
    if (!variant) return;
    add.mutate(
      { variantId: variant.id, quantity: 1 },
      {
        onSuccess: () => {
          toast.success(t('added'));
          openCart();
          track('add_to_cart', { value: price, items: [{ id: variant.sku, name: product.name, variant: colorName, price, quantity: 1 }] });
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : tc('error')),
      },
    );
  };

  const sizeAvailable = (s: string) => product.variants.some((v) => v.size === s && (v.color?.slug ?? null) === color && v.inStock);
  const days = shipping?.estimatedDays ?? '1-3';
  const tabs = [
    { id: 'description', title: t('description'), body: product.description ?? '' },
    { id: 'details', title: t('details'), body: [product.dimensions, product.madeIn ? `${t('madeIn')}: ${product.madeIn}` : null].filter(Boolean).join('\n\n') },
    { id: 'materials', title: t('materialCare'), body: [product.material, product.care].filter(Boolean).join('\n\n') },
    { id: 'shipping', title: t('shippingReturns'), body: [t('perks.shipping', { days }), t('perks.returns'), t('perks.installments'), t('perks.gift')].join('\n') },
  ].filter((i) => i.body);

  return (
    <div className="md:grid md:grid-cols-2">
      <div className="relative">
        <div className="absolute top-4 left-4 z-10 md:left-6">{crumb}</div>
        <Gallery stacked={stacked} all={photos} name={product.name} />
      </div>

      <div className="md:sticky md:top-[69px] md:self-start">
        <div className="mx-auto flex max-w-[520px] flex-col items-center gap-7 px-5 py-10 text-center md:min-h-[calc(100svh-69px)] md:justify-center md:px-8">
          <div className="flex flex-col items-center gap-2">
            <h1 className="font-serif text-[30px] leading-tight font-light md:text-[34px]">{product.name}</h1>
            <p className="label text-muted">{[modelNo(product.number), colorName].filter(Boolean).join(' · ')}</p>
            <p className="label mt-1">
              {money(price, locale)}
              {compareAt && compareAt > price ? <span className="ml-3 text-muted line-through">{money(compareAt, locale)}</span> : null}
            </p>
          </div>

          {lead ? (
            <div className="relative hidden aspect-square w-full max-w-[360px] bg-ground md:block">
              <Image src={lead.url} alt={lead.alt ?? product.name} fill priority sizes="360px" className="object-contain mix-blend-multiply" />
            </div>
          ) : null}

          {colors.length > 1 ? (
            <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label={t('color')}>
              {colors.map((c) => {
                const thumb = thumbFor(c.slug);
                const on = c.slug === color;
                return (
                  <button key={c.slug} type="button" role="radio" aria-checked={on} aria-label={c.name} title={c.name} onClick={() => setColor(c.slug)} className={`relative flex h-16 w-16 items-center justify-center border bg-ground transition-colors ${on ? 'border-ink' : 'border-transparent hover:border-line'} ${!c.inStock ? 'opacity-40' : ''}`}>
                    {thumb ? <Image src={thumb.url} alt="" fill sizes="64px" className="object-contain p-1.5 mix-blend-multiply" /> : <Swatch hex={c.hex} hex2={c.hex2} size={22} selected={on} />}
                  </button>
                );
              })}
            </div>
          ) : null}

          {sizes.length ? (
            <div className="flex flex-col items-center gap-3">
              <p className="label text-muted">{t('size')}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {sizes.map((s) => (
                  <button key={s} type="button" aria-pressed={s === size} onClick={() => setSize(s)} className={`min-w-12 border px-3 py-2.5 text-sm ${s === size ? 'border-ink bg-ink text-ground' : 'border-line hover:border-ink'} ${!sizeAvailable(s) ? 'text-muted line-through' : ''}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex w-full flex-col gap-3">
            {soldOut ? (
              <StockAlert variantId={variant!.id} />
            ) : (
              <div className="flex w-full gap-2">
                <button type="button" onClick={addToCart} disabled={needsSize || !variant || add.isPending} className="btn-primary flex-1">
                  {needsSize ? t('selectSize') : t('addToCart')}
                </button>
                <WishlistButton productId={product.id} initial={wishlisted} />
              </div>
            )}
            {variant?.lowStock ? <p className="text-xs text-brand">{tc('lowStock', { count: 3 })}</p> : null}
            {tryon ? <TryOn slug={product.slug} color={color} productName={product.name} /> : null}
          </div>

          <ProductTabs items={tabs} />
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
