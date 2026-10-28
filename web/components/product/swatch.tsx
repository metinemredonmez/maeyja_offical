/** Colour dot; bicolor renders a split circle. Pure CSS, no gradient wash. */
export function Swatch({ hex, hex2, size = 28, selected = false, title }: { hex: string; hex2?: string | null; size?: number; selected?: boolean; title?: string }) {
  const light = isLight(hex);
  return (
    <span
      title={title}
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${selected ? 'ring-1 ring-ink ring-offset-2 ring-offset-ground' : ''}`}
      style={{
        width: size,
        height: size,
        background: hex2 ? `linear-gradient(90deg, ${hex} 50%, ${hex2} 50%)` : hex,
        boxShadow: light || hex2 ? 'inset 0 0 0 1px #C9C3B9' : undefined,
      }}
    />
  );
}

function isLight(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}
