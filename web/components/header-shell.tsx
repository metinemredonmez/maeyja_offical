'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { usePathname } from '@/i18n/navigation';

/**
 * On the home page the header floats transparent over the hero and the logo starts as a
 * screen-wide wordmark that shrinks into its slot as you scroll (Wandler); the bar turns cream
 * once the hero is behind it. Everywhere else it is the plain sticky bar.
 * The shrink is driven by CSS variables (--p progress, --s start scale, --y0 start offset).
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const home = usePathname() === '/';
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !home) return;
    const logo = el.querySelector<HTMLElement>('[data-wordmark]');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;

    const measure = () => {
      if (!logo || reduce) return;
      el.style.setProperty('--s', String(Math.max(1, (innerWidth * 0.92) / logo.offsetWidth)));
      // Giant wordmark sits just under the menu row.
      el.style.setProperty('--y0', `${el.offsetHeight - logo.offsetTop + 8}px`);
    };
    const update = () => {
      frame = 0;
      el.style.setProperty('--p', reduce ? '1' : Math.min(1, scrollY / (innerHeight * 0.55)).toFixed(4));
      el.toggleAttribute('data-solid', scrollY > innerHeight - el.offsetHeight);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    update();
    el.setAttribute('data-ready', '');
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onResize);
      el.removeAttribute('data-ready');
      el.removeAttribute('data-solid');
      for (const v of ['--p', '--s', '--y0']) el.style.removeProperty(v);
    };
  }, [home]);

  return (
    <header ref={ref} data-home={home ? '' : undefined} className={`site-header z-30 border-b border-line bg-ground/95 text-ink backdrop-blur ${home ? 'fixed inset-x-0 top-0' : 'sticky top-0'}`}>
      {children}
    </header>
  );
}
