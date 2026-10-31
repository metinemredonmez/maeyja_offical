'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { usePathname } from '@/i18n/navigation';

/**
 * The sticky white bar (BOYY). On the home page the big MAEYJA masthead sits just under it (Canan's page 1), so
 * the bar's own small wordmark stays hidden until the masthead has scrolled out of view.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const home = usePathname() === '/';
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !home) return;
    const masthead = document.querySelector('[data-masthead]');
    if (!masthead) {
      el.setAttribute('data-solid', '');
      return;
    }
    const io = new IntersectionObserver(([entry]) => el.toggleAttribute('data-solid', !entry.isIntersecting), { rootMargin: `-${el.offsetHeight}px 0px 0px 0px` });
    io.observe(masthead);
    return () => {
      io.disconnect();
      el.removeAttribute('data-solid');
    };
  }, [home]);

  return (
    <header ref={ref} data-home={home ? '' : undefined} className="site-header sticky top-0 z-30 bg-ground text-ink">
      {children}
    </header>
  );
}
