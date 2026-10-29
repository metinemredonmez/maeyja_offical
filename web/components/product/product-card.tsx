import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { modelNo, money } from '@/lib/format';
import type { ProductCard as Card } from '@/lib/types';
import { Swatch } from './swatch';

/**
 * Listing tile (Aesther Ekme): the bag on a stone tile, the second photo glides in on hover, centred
 * small-caps `N°01 ORIGAMI`, price and colour dots underneath.
 */
export function ProductCard({ product: p, priority = false }: { product: Card; priority?: boolean }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const [a, b] = p.images;
  return (
    <Link href={`/products/${p.slug}`} className="group flex flex-col items-center gap-4 text-center">
      <span className="relative block aspect-[4/5] w-full overflow-hidden bg-stone">
        {a ? (
          <Image src={a.url} alt={a.alt ?? p.name} fill priority={priority} sizes="(min-width: 1024px) 33vw, 50vw" className={`object-cover transition duration-[900ms] ease-out group-hover:scale-[1.04] ${b ? 'group-hover:opacity-0' : ''}`} />
        ) : null}
        {b ? <Image src={b.url} alt="" fill sizes="(min-width: 1024px) 33vw, 50vw" className="scale-[1.08] object-cover opacity-0 transition duration-[900ms] ease-out group-hover:scale-100 group-hover:opacity-100" /> : null}
        {!p.inStock ? <span className="label absolute bottom-3 left-3 bg-ground px-2 py-1">{t('soldOut')}</span> : null}
      </span>
      <span className="flex flex-col items-center gap-1.5">
        <span className="label group-hover:text-brand">
          {modelNo(p.number) ? <span className="text-muted">{modelNo(p.number)}&nbsp;</span> : null}
          {p.name}
        </span>
        <span className="text-[13px] text-ink-soft">{p.hasPriceRange ? `${money(p.price, locale)}+` : money(p.price, locale)}</span>
        {p.colors.length > 1 ? (
          <span className="mt-1 flex gap-1.5">
            {p.colors.slice(0, 6).map((c) => (
              <Swatch key={c.slug} hex={c.hex} hex2={c.hex2} size={9} title={c.name} />
            ))}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
