'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import type { ProductList } from '@/lib/types';
import { Swatch } from './swatch';

type Current = { color?: string; size?: string; sort?: string };

/** URL-driven filters so results are shareable and server-rendered. */
export function Filters({ facets, current }: { facets: ProductList['facets']; current: Current }) {
  const t = useTranslations('shop');
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}` as never, { scroll: false });
  };
  const toggleList = (key: string, value: string) => {
    const set = new Set((sp.get(key) ?? '').split(',').filter(Boolean));
    set.has(value) ? set.delete(value) : set.add(value);
    update(key, [...set].join(',') || null);
  };
  const selectedColors = new Set((current.color ?? '').split(',').filter(Boolean));
  const selectedSizes = new Set((current.size ?? '').split(',').filter(Boolean));
  const hasAny = selectedColors.size || selectedSizes.size || current.sort;

  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-6 border-y border-line py-4">
      <div className="flex flex-wrap items-center gap-7">
        {facets.colors.length ? (
          <div className="flex items-center gap-3">
            <span className="label text-muted">{t('color')}</span>
            {facets.colors.map((c) => (
              <button key={c.slug} type="button" aria-label={c.name} aria-pressed={selectedColors.has(c.slug)} onClick={() => toggleList('color', c.slug)} className="rounded-full p-0.5">
                <Swatch hex={c.hex} hex2={c.hex2} size={22} selected={selectedColors.has(c.slug)} />
              </button>
            ))}
          </div>
        ) : null}
        {facets.sizes.length ? (
          <div className="flex items-center gap-2">
            <span className="label mr-1 text-muted">{t('size')}</span>
            {facets.sizes.map((s) => (
              <button key={s.size} type="button" aria-pressed={selectedSizes.has(s.size)} onClick={() => toggleList('size', s.size)} className={`border px-2.5 py-1.5 text-xs ${selectedSizes.has(s.size) ? 'border-ink bg-ink text-ground' : 'border-line hover:border-ink'}`}>
                {s.size}
              </button>
            ))}
          </div>
        ) : null}
        {hasAny ? (
          <button type="button" onClick={() => router.replace(pathname as never, { scroll: false })} className="label text-muted hover:text-brand">
            {t('clear')}
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor="sort" className="label text-muted">
          {t('sort')}
        </label>
        <select id="sort" value={current.sort ?? 'featured'} onChange={(e) => update('sort', e.target.value === 'featured' ? null : e.target.value)} className="border-0 border-b border-ink bg-transparent py-1 text-xs focus:outline-none">
          <option value="featured">{t('sortFeatured')}</option>
          <option value="newest">{t('sortNewest')}</option>
          <option value="price_asc">{t('sortPriceAsc')}</option>
          <option value="price_desc">{t('sortPriceDesc')}</option>
        </select>
      </div>
    </div>
  );
}
