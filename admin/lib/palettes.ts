/**
 * Colour palettes for the admin, picked in the top bar (the same set as the Yoga app: Okyanus and the six-tone
 * Casalume palettes). A palette is six tones, darkest to lightest; the admin's colour variables are derived from
 * them so every text/background pair reaches WCAG AA 4.5:1. MAEYJA is the default black-and-white look from
 * globals.css. The admin is light only, so only light tokens are derived.
 *
 * The choice lives in the `admin_palette` cookie; the root layout reads it, so the page paints in it at once.
 */

export const PALETTE_COOKIE = 'admin_palette';

export type PaletteId =
  | 'maeyja'
  | 'okyanus'
  | 'kahve'
  | 'tarcin'
  | 'gul-kurusu'
  | 'visne'
  | 'lavanta'
  | 'orman'
  | 'petrol'
  | 'arduvaz';

interface PaletteTokens {
  /** Page background */
  bg: string;
  /** Cards, menus */
  surface: string;
  /** Second surface: inputs, chips, muted blocks */
  surface2: string;
  text: string;
  /** Secondary text */
  muted: string;
  /** Buttons, links, active states */
  primary: string;
  /** Text on a primary button */
  onPrimary: string;
  /** Pressed / emphasised primary */
  primaryStrong: string;
  /** Light tint of primary: hover rows, badges */
  primarySoft: string;
  border: string;
}

export interface Palette {
  id: PaletteId;
  name: string;
  tones: readonly string[];
  /** null: the default look in globals.css */
  tokens: PaletteTokens | null;
}

export const DEFAULT_PALETTE: PaletteId = 'maeyja';

// ---- colour maths (sRGB, WCAG 2 relative luminance) ----

const WHITE = '#ffffff';
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) =>
  `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;

function mix(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  return toHex(A.map((x, i) => x * (1 - t) + B[i] * t));
}

function luminance(h: string): number {
  const [r, g, b] = rgb(h).map((x) => {
    const c = x / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The first candidate that passes; the last one otherwise */
const first = (candidates: string[], ok: (c: string) => boolean) =>
  candidates.find(ok) ?? candidates[candidates.length - 1];
const AA = 4.6; // a hair above 4.5 so rounding never lands below the line

/** A pale page from the lightest tone, dark text, the deepest mid tone that white text can sit on */
function lightTokens(tones: readonly string[]): PaletteTokens {
  const [t0, t1, t2, t3, t4, t5] = tones;
  const bg = mix(t5, WHITE, 0.45);
  const surface = mix(t5, WHITE, 0.85);
  const surface2 = mix(t5, t4, 0.25);
  const primarySoft = mix(t5, WHITE, 0.15);
  const muted = first([t2, mix(t1, t2, 0.5), t1], (c) => Math.min(contrast(c, bg), contrast(c, surface), contrast(c, surface2)) >= AA);
  const primary = first(
    [t3, mix(t2, t3, 0.5), t2, mix(t1, t2, 0.5), t1],
    (c) => Math.min(contrast(WHITE, c), contrast(c, bg), contrast(c, surface), contrast(c, primarySoft)) >= AA,
  );
  return {
    bg,
    surface,
    surface2,
    text: t0,
    muted,
    primary,
    onPrimary: WHITE,
    primaryStrong: mix(primary, t0, 0.3),
    primarySoft,
    border: mix(t4, t5, 0.5),
  };
}

const palette = (id: PaletteId, name: string, tones: string[]): Palette => {
  const t = tones.map((x) => x.toLowerCase());
  return { id, name, tones: t, tokens: lightTokens(t) };
};

/** Okyanus is not derived: its colours are the Blue Therapy icon's own (deep blue primary, icon gradient swatch) */
const OKYANUS: Palette = {
  id: 'okyanus',
  name: 'Okyanus',
  tones: ['#03162b', '#0a2e57', '#014bae', '#2e95c9', '#5ddfe6', '#e6f9fb'],
  tokens: {
    bg: '#f4fbfd',
    surface: '#ffffff',
    surface2: '#e6f6fa',
    text: '#03162b',
    muted: '#4a6178',
    primary: '#014bae',
    onPrimary: '#ffffff',
    primaryStrong: '#013c8b',
    primarySoft: '#e3f4fb',
    border: '#cdebf3',
  },
};

export const PALETTES: readonly Palette[] = [
  { id: 'maeyja', name: 'MAEYJA', tones: ['#0a0a0a', '#262626', '#525252', '#a3a3a3', '#e5e5e5', '#ffffff'], tokens: null },
  OKYANUS,
  palette('kahve', 'Kahve', ['#211713', '#493126', '#78533B', '#B18A62', '#E0C58E', '#F6EEDB']),
  palette('tarcin', 'Tarçın', ['#211713', '#493027', '#76503B', '#A87557', '#D0A98B', '#F0DFCE']),
  palette('gul-kurusu', 'Gül Kurusu', ['#3E3239', '#6B5560', '#9E8189', '#C7A9A3', '#E8D2C4', '#F7EFE7']),
  palette('visne', 'Vişne', ['#1D1015', '#421B29', '#702B40', '#A64C61', '#D28B96', '#F1DDE0']),
  palette('lavanta', 'Lavanta', ['#17121D', '#302538', '#51405F', '#796487', '#B09BB8', '#E8DDEB']),
  palette('orman', 'Orman', ['#051F20', '#0B2B26', '#163832', '#235347', '#8EB69B', '#DAF1DE']),
  palette('petrol', 'Petrol', ['#071C27', '#123747', '#245568', '#477C8B', '#91B3B9', '#DCE9E8']),
  palette('arduvaz', 'Arduvaz', ['#06141B', '#11212D', '#253745', '#4A5C6A', '#9BA8AB', '#CCD0CF']),
];

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === 'string' && PALETTES.some((p) => p.id === value);
}

/** A stored value that is not a palette (junk, a removed palette) means the default */
export function getPalette(id: string | null | undefined): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** The class on <html> that switches the variables; none for the default */
export function paletteClass(id: PaletteId): string | undefined {
  return getPalette(id).tokens ? `theme-${id}` : undefined;
}

function vars(t: PaletteTokens): string {
  const entries: Array<[string, string]> = [
    ['background', t.bg],
    ['foreground', t.text],
    ['card', t.surface],
    ['card-foreground', t.text],
    ['popover', t.surface],
    ['popover-foreground', t.text],
    ['primary', t.primary],
    ['primary-foreground', t.onPrimary],
    ['secondary', t.surface2],
    ['secondary-foreground', t.text],
    ['muted', t.surface2],
    ['muted-foreground', t.muted],
    ['accent', t.primarySoft],
    ['accent-foreground', t.primaryStrong],
    ['border', t.border],
    ['input', t.border],
    ['ring', t.primary],
    ['sidebar', t.surface],
    ['sidebar-foreground', t.text],
    ['sidebar-primary', t.primary],
    ['sidebar-primary-foreground', t.onPrimary],
    ['sidebar-accent', t.primarySoft],
    ['sidebar-accent-foreground', t.primaryStrong],
    ['sidebar-border', t.border],
    ['sidebar-ring', t.primary],
  ];
  return entries.map(([k, v]) => `--${k}:${v};`).join('');
}

/** `:root.theme-<id>` outranks the plain `:root` in globals.css whatever the order in the page */
export const PALETTES_CSS = PALETTES.filter((p) => p.tokens)
  .map((p) => `:root.theme-${p.id}{${vars(p.tokens!)}}`)
  .join('\n');
