import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { money } from '@/lib/format';
import type { ProductCard as Card } from '@/lib/types';

/**
 * BOYY tile: the bag on flat grey (the photo's own grey is the tile; a strap cut by the original frame meets the
 * tile's edge, not the middle of it), the second photo fades in on hover; "<i>Petal Box</i>, Chili" and the price centred under it.
 */
export function ProductCard({ product: p, priority = false }: { product: Card; priority?: boolean }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const [a, b] = p.images;
  const colour = p.colors.length === 1 ? p.colors[0].name : null;
  return (
    <Link href={`/products/${p.slug}`} className="group flex flex-col items-center gap-3 text-center">
      <span className="relative block aspect-[4/5] w-full bg-stone">
        {a ? (
          <Image src={a.url} alt={a.alt ?? p.name} fill priority={priority} sizes="(min-width: 1024px) 25vw, 50vw" className={`object-cover transition-opacity duration-500 ${b ? 'group-hover:opacity-0' : ''}`} />
        ) : null}
        {b ? <Image src={b.url} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" /> : null}
        {!p.inStock ? <span className="label absolute bottom-3 left-3 text-muted">{t('soldOut')}</span> : null}
      </span>
      <span className="flex flex-col items-center gap-0.5 px-2 text-[13px] leading-snug">
        <span>
          <i>{p.name}</i>
          {colour ? `, ${colour}` : null}
        </span>
        <span className="text-ink-soft">{p.hasPriceRange ? `${money(p.price, locale)}+` : money(p.price, locale)}</span>
      </span>
    </Link>
  );
}
