'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/lib/types';

type Img = Product['images'][number];

/**
 * Desktop: every photo stacked down the left column on flat grey while the panel stays put (BOYY).
 * Mobile: a swipe carousel with dots.
 */
export function Gallery({ photos, name }: { photos: Img[]; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  if (!photos.length) return <div className="aspect-[4/5] w-full bg-stone" />;

  return (
    <div>
      <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth md:hidden" style={{ scrollbarWidth: 'none' }}>
        {photos.map((img, i) => (
          <div key={img.id} className="relative aspect-[4/5] w-full shrink-0 snap-start bg-stone">
            <Image src={img.url} alt={img.alt ?? `${name} ${i + 1}`} fill priority={i === 0} sizes="100vw" className="object-cover" />
          </div>
        ))}
      </div>
      {photos.length > 1 ? (
        <div className="mt-3 flex justify-center gap-2 md:hidden" aria-hidden="true">
          {photos.map((img, i) => (
            <span key={img.id} className={`h-1.5 w-1.5 rounded-full ${i === active ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
      ) : null}
      <div className="hidden flex-col gap-5 md:flex">
        {photos.map((img, i) => (
          <div key={img.id} className="relative aspect-[4/5] w-full bg-stone">
            <Image src={img.url} alt={img.alt ?? `${name} ${i + 1}`} fill priority={i === 0} sizes="(min-width: 1320px) 680px, 52vw" className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
