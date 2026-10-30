'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Silent loop that only plays while on screen (Mlouye); "reduce motion" visitors keep the poster frame.
 * `wideOnly`: the film sits over a still that is already on the page, so phones never download it and wider
 * screens fade it in once it plays.
 */
export function AutoVideo({ src, poster, className, wideOnly = false }: { src: string; poster?: string | null; className?: string; wideOnly?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (wideOnly) {
      if (!matchMedia('(min-width: 768px)').matches) return;
      video.src = src;
    }
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? void video.play().catch(() => undefined) : video.pause()), { threshold: 0.15 });
    io.observe(video);
    return () => io.disconnect();
  }, [src, wideOnly]);

  if (wideOnly) {
    return (
      <video
        ref={ref}
        className={`${className ?? ''} transition-opacity duration-700 ${playing ? 'opacity-100' : 'opacity-0'}`}
        muted
        loop
        playsInline
        preload="none"
        onPlaying={() => setPlaying(true)}
        aria-hidden="true"
      />
    );
  }
  return (
    <video ref={ref} className={className} muted loop playsInline preload="metadata" poster={poster ?? undefined} aria-hidden="true">
      <source src={src} />
    </video>
  );
}
