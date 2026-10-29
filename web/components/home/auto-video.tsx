'use client';

import { useEffect, useRef } from 'react';

/** Silent loop that only plays while on screen (Mlouye); "reduce motion" visitors keep the poster frame. */
export function AutoVideo({ src, poster, className }: { src: string; poster?: string | null; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? void video.play().catch(() => undefined) : video.pause()), { threshold: 0.15 });
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <video ref={ref} className={className} muted loop playsInline preload="metadata" poster={poster ?? undefined} aria-hidden="true">
      <source src={src} />
    </video>
  );
}
