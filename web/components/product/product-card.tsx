import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { money } from '@/lib/format';
import type { ProductCard as Card } from '@/lib/types';
import { Swatch } from './swatch';

/** Listing card: 4:5 image, second image on hover, name/price row, colour dots. */
export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const [first, second] = product.images;
  return (
    <Link href={`/products/${product.slug}`} className="group flex flex-col gap-3">
      <div className="ph relative aspect-[4/5] overflow-hidden">
        {first ? (
          <Image src={first.url} alt={first.alt ?? product.name} fill priority={priority} sizes="(min-width: 1024px) 33vw, 50vw" className={`object-cover transition duration-[900ms] ease-out group-hover:scale-[1.04] ${second ? 'group-hover:opacity-0' : ''}`} />
        ) : null}
        {second ? <Image src={second.url} alt="" fill sizes="(min-width: 1024px) 33vw, 50vw" className="scale-[1.08] object-cover opacity-0 transition duration-[900ms] ease-out group-hover:scale-100 group-hover:opacity-100" /> : null}
        {!product.inStock ? <span className="label absolute bottom-4 left-4 bg-ground px-2.5 py-1.5">{t('soldOut')}</span> : null}
      </div>
      <div className="flex items-start justify-between gap-3 text-sm">
        <span className="group-hover:text-brand">{product.name}</span>
        <span className="shrink-0">
          {product.hasPriceRange ? `${money(product.price, locale)}+` : money(product.price, locale)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        {product.subtitle ? <span className="text-xs text-muted">{product.subtitle}</span> : <span />}
        {product.colors.length > 1 ? (
          <span className="flex gap-1.5">
            {product.colors.slice(0, 6).map((c) => (
              <Swatch key={c.slug} hex={c.hex} hex2={c.hex2} size={10} title={c.name} />
            ))}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
