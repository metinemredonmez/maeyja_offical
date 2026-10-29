'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/lib/types';

type Img = Product['images'][number];

/**
 * Desktop: the photos stacked down the left half while the buy panel stays put (Polène).
 * Mobile: a swipe carousel with dots that includes every photo of the selected colour.
 */
export function Gallery({ stacked, all, name }: { stacked: Img[]; all: Img[]; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  if (!all.length) return <div className="ph aspect-[4/5] w-full" />;

  return (
    <>
      <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth md:hidden" style={{ scrollbarWidth: 'none' }}>
        {all.map((img, i) => (
          <div key={img.id} className="ph relative aspect-[4/5] w-full shrink-0 snap-start">
            <Image src={img.url} alt={img.alt ?? `${name} ${i + 1}`} fill priority={i === 0} sizes="100vw" className="object-cover" />
          </div>
        ))}
      </div>
      {all.length > 1 ? (
        <div className="mt-3 flex justify-center gap-2 md:hidden" aria-hidden="true">
          {all.map((img, i) => (
            <span key={img.id} className={`h-1.5 w-1.5 rounded-full ${i === active ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
      ) : null}
      <div className="hidden flex-col md:flex">
        {stacked.map((img, i) => (
          <div key={img.id} className="ph relative aspect-[4/5] w-full">
            <Image src={img.url} alt={img.alt ?? `${name} ${i + 1}`} fill priority={i === 0} sizes="50vw" className="object-cover" />
          </div>
        ))}
      </div>
    </>
  );
}
