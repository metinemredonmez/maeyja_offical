'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api.client';
import { money } from '@/lib/format';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/tracking';
import type { Product, PublicSettings } from '@/lib/types';
import { useCartMutations } from '@/components/cart/use-cart';
import { useCartUi } from '@/components/cart/cart-ui';
import { Gallery } from './gallery';
import { Swatch } from './swatch';
import { WishlistButton } from './wishlist-button';
import { TryOn } from './try-on';

/** Another colourway of the same model: its own page (BOYY), reached from the swatches. */
export type Sibling = { slug: string; name: string; hex: string; hex2: string | null; current: boolean };

/**
 * BOYY product view. Left: every photo of the bag stacked on flat grey. Right (sticky): "<i>Petal Box</i>, Chili",
 * the price, the description, colourway swatches, the Details / Shipping / Care boxes and the two buttons.
 * Owns the colour/size selection for products that carry several variants themselves.
 */
export function BuyBox({ product, shipping, wishlisted, siblings, tryon = false }: { product: Product; shipping: PublicSettings['shipping'] | null; wishlisted: boolean; siblings: Sibling[]; tryon?: boolean }) {
  const t = useTranslations('product');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
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
  const colorName = colors.find((c) => c.slug === color)?.name;

  // Ad pixels: the product view once per product, and each add to bag.
  useEffect(() => {
    track('view_item', { value: price, items: [{ id: product.variants[0]?.sku ?? product.slug, name: product.name, price, quantity: 1 }] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per product
  }, [product.slug]);

  const addToCart = (then: 'drawer' | 'checkout') => {
    if (!variant) return;
    add.mutate(
      { variantId: variant.id, quantity: 1 },
      {
        onSuccess: () => {
          track('add_to_cart', { value: price, items: [{ id: variant.sku, name: product.name, variant: colorName, price, quantity: 1 }] });
          if (then === 'checkout') return router.push('/checkout');
          toast.success(t('added'));
          openCart();
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : tc('error')),
      },
    );
  };

  const sizeAvailable = (s: string) => product.variants.some((v) => v.size === s && (v.color?.slug ?? null) === color && v.inStock);
  const days = shipping?.estimatedDays ?? '1-3';
  const details = [
    product.dimensions ? `${t('dimensions')}: ${product.dimensions}` : null,
    product.material ? `${t('composition')}: ${product.material}` : null,
    product.madeIn ? `${t('madeIn')}: ${product.madeIn}` : null,
  ].filter(Boolean);
  const boxes = [
    { title: t('details'), body: details.join('\n') },
    { title: t('shippingReturns'), body: [t('perks.shipping', { days }), t('perks.returns'), t('perks.installments'), t('perks.gift')].join('\n') },
    { title: t('care'), body: product.care ?? '' },
  ].filter((b) => b.body);
  const swatches: Sibling[] = colors.length > 1 ? [] : siblings;

  return (
    <div className="mx-auto w-full max-w-[1320px] md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-14 md:px-10 md:pt-6 lg:gap-24">
      <Gallery photos={photos} name={product.name} />

      <div className="md:sticky md:top-[76px] md:self-start">
        <div className="flex max-w-[440px] flex-col gap-6 px-5 py-8 md:px-0 md:pt-[18vh]">
          <div className="flex flex-col gap-1 text-[16px] leading-snug">
            <h1>
              <i>{product.name}</i>
              {colorName ? `, ${colorName}` : null}
            </h1>
            <p>
              {money(price, locale)}
              {compareAt && compareAt > price ? <span className="ml-2 text-muted line-through">{money(compareAt, locale)}</span> : null}
              <span className="ml-2 text-[13px] text-muted">({t('vatIncluded')})</span>
            </p>
          </div>

          {product.description ? <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink-soft">{product.description.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim()}</p> : null}

          {swatches.length ? (
            <div className="flex flex-wrap gap-2.5" aria-label={t('color')}>
              {swatches.map((c) => (
                <Link key={c.slug} href={`/products/${c.slug}`} aria-current={c.current ? 'page' : undefined} title={c.name} className="rounded-full p-[3px] ring-1 ring-transparent aria-[current=page]:ring-ink hover:ring-line">
                  <Swatch hex={c.hex} hex2={c.hex2} size={18} />
                  <span className="sr-only">{c.name}</span>
                </Link>
              ))}
            </div>
          ) : null}

          {colors.length > 1 ? (
            <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={t('color')}>
              {colors.map((c) => (
                <button key={c.slug} type="button" role="radio" aria-checked={c.slug === color} aria-label={c.name} title={c.name} onClick={() => setColor(c.slug)} className={`rounded-full p-[3px] ring-1 ${c.slug === color ? 'ring-ink' : 'ring-transparent hover:ring-line'} ${!c.inStock ? 'opacity-40' : ''}`}>
                  <Swatch hex={c.hex} hex2={c.hex2} size={18} />
                </button>
              ))}
            </div>
          ) : null}

          {sizes.length ? (
            <div className="flex flex-col gap-3">
              <p className="label text-muted">{t('size')}</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button key={s} type="button" aria-pressed={s === size} onClick={() => setSize(s)} className={`min-w-11 rounded-[3px] border px-3 py-2 text-sm ${s === size ? 'border-ink bg-ink text-ground' : 'border-line hover:border-ink'} ${!sizeAvailable(s) ? 'text-muted line-through' : ''}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {boxes.length ? (
            <div className="rounded-[3px] border border-ink">
              {boxes.map((b) => (
                <details key={b.title} className="group border-b border-ink last:border-b-0">
                  <summary className="label flex cursor-pointer list-none items-center justify-between px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                    <span>{b.title}</span>
                    <span aria-hidden="true" className="text-[15px] leading-none font-light group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="whitespace-pre-line px-3 pb-4 text-[13.5px] leading-relaxed text-ink-soft">{b.body}</p>
                </details>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {soldOut ? (
              <StockAlert variantId={variant!.id} />
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => addToCart('checkout')} disabled={needsSize || !variant || add.isPending} className="btn-primary">
                  {needsSize ? t('selectSize') : t('buyNow')}
                </button>
                <button type="button" onClick={() => addToCart('drawer')} disabled={needsSize || !variant || add.isPending} className="btn-outline">
                  {t('addToCart')}
                </button>
                <WishlistButton productId={product.id} initial={wishlisted} />
              </div>
            )}
            {variant?.lowStock ? <p className="text-xs text-brand">{tc('lowStock', { count: 3 })}</p> : null}
            {tryon ? <TryOn slug={product.slug} color={color} productName={product.name} /> : null}
          </div>
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
