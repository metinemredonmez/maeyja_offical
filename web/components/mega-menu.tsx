'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname } from '@/i18n/navigation';

/**
 * A header label that opens a full-width panel under the bar on hover, focus or click (Polène). The panel is
 * positioned against the header itself, so it spans the whole width wherever the label sits.
 */
export function MegaItem({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closing = useRef(0);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);

  const enter = () => {
    clearTimeout(closing.current);
    setOpen(true);
  };
  // A short grace period so moving the pointer from the label down into the panel doesn't close it.
  const leave = () => {
    closing.current = window.setTimeout(() => setOpen(false), 150);
  };

  return (
    <div onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && leave()}>
      <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)} className={`label hover:text-brand ${open ? 'underline underline-offset-[6px]' : ''}`}>
        {label}
      </button>
      <div
        className={`absolute inset-x-0 top-full border-b border-line bg-ground font-sans text-[15px] tracking-normal text-ink normal-case shadow-[0_30px_40px_-30px_rgba(0,0,0,0.18)] transition-[opacity,visibility] duration-200 ${open ? 'visible opacity-100' : 'invisible opacity-0'}`}
        onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}
      >
        {children}
      </div>
    </div>
  );
}
