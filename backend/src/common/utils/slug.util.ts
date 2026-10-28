const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u' };

export function slugify(input: string): string {
  return input
    .trim()
    .replace(/[çğıİöşü]/gi, (ch) => TR_MAP[ch] ?? TR_MAP[ch.toLowerCase()] ?? ch)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}
