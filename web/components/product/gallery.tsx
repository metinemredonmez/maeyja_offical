'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/lib/types';

/**
 * Desktop: vertical stack (the page scrolls past it while the buy box stays sticky).
 * Mobile: horizontal snap carousel with dots.
 * Images tagged with a colour show only when that colour is selected; untagged ones always show.
 */
export function Gallery({ images, colorSlug, name }: { images: Product['images']; colorSlug: string | null; name: string }) {
  const visible = images.filter((i) => !i.colorSlug || i.colorSlug === colorSlug);
  const list = visible.length ? visible : images;
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setActive(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  if (!list.length) return <div className="ph aspect-[4/5] w-full" />;

  return (
    <>
      <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth md:hidden" style={{ scrollbarWidth: 'none' }}>
        {list.map((img, i) => (
          <div key={img.id} className="ph relative aspect-[4/5] w-full shrink-0 snap-start">
            <Image src={img.url} alt={img.alt ?? `${name} ${i + 1}`} fill priority={i === 0} sizes="100vw" className="object-cover" />
          </div>
        ))}
      </div>
      {list.length > 1 ? (
        <div className="mt-3 flex justify-center gap-2 md:hidden" aria-hidden="true">
          {list.map((img, i) => (
            <span key={img.id} className={`h-1.5 w-1.5 rounded-full ${i === active ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
      ) : null}
      <div className="hidden flex-col gap-4 md:flex">
        {list.map((img, i) => (
          <div key={img.id} className="ph relative aspect-[4/5] w-full">
            <Image src={img.url} alt={img.alt ?? `${name} ${i + 1}`} fill priority={i === 0} sizes="(min-width: 768px) 58vw, 100vw" className="object-cover" />
          </div>
        ))}
      </div>
    </>
  );
}
