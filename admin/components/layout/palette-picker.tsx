'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { PaletteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PALETTE_COOKIE, PALETTES, getPalette, isPaletteId, paletteClass, type PaletteId } from '@/lib/palettes';
import { cn } from '@/lib/utils';

type PaletteContextValue = { palette: PaletteId; setPalette: (id: PaletteId) => void };

const PaletteContext = createContext<PaletteContextValue | null>(null);

/** Holds the chosen palette; the root layout passes the one it read from the cookie */
export function PaletteProvider({ initial, children }: { initial: PaletteId; children: React.ReactNode }) {
  const [palette, setState] = useState<PaletteId>(initial);

  const setPalette = useCallback((id: PaletteId) => {
    setState(id);
    const root = document.documentElement;
    Array.from(root.classList)
      .filter((c) => c.startsWith('theme-'))
      .forEach((c) => root.classList.remove(c));
    const cls = paletteClass(id);
    if (cls) root.classList.add(cls);
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${PALETTE_COOKIE}=${id}; path=/; max-age=31536000; SameSite=Lax${secure}`;
  }, []);

  const value = useMemo(() => ({ palette, setPalette }), [palette, setPalette]);
  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}

export function usePalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error('usePalette must be used within PaletteProvider');
  return ctx;
}

/** A palette's six tones as a small strip */
function PaletteStrip({ tones, className }: { tones: readonly string[]; className?: string }) {
  return (
    <span className={cn('flex h-4 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10', className)} aria-hidden>
      {tones.map((t, i) => (
        <span key={`${t}-${i}`} className="flex-1" style={{ background: t }} />
      ))}
    </span>
  );
}

/** Colour palette menu in the top bar; the choice is kept per browser in a cookie */
export function PalettePicker() {
  const { palette, setPalette } = usePalette();
  const active = getPalette(palette);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            aria-label={`Renk paleti: ${active.name}. Değiştirmek için aç`}
            title="Renk paletini değiştir"
          />
        }
      >
        <PaletteIcon />
        <PaletteStrip tones={active.tones} className="hidden h-3 w-8 sm:flex" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Base UI requires GroupLabel inside a Group, otherwise opening the menu throws (error #31). */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Renk paleti</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={active.id} onValueChange={(v) => isPaletteId(v) && setPalette(v)}>
            {PALETTES.map((p) => (
              <DropdownMenuRadioItem key={p.id} value={p.id} className="gap-3 py-1.5">
                <PaletteStrip tones={p.tones} />
                <span className="truncate">{p.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
