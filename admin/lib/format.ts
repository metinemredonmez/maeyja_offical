import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 });
const number = new Intl.NumberFormat('tr-TR');

export const formatMoney = (value: number | string | null | undefined) => money.format(Number(value ?? 0));
export const formatNumber = (value: number | string | null | undefined) => number.format(Number(value ?? 0));

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

export const formatDateTime = (value: string | Date | null | undefined) => {
  const d = toDate(value);
  return d ? format(d, 'd MMM yyyy HH:mm', { locale: tr }) : '—';
};
export const formatDate = (value: string | Date | null | undefined) => {
  const d = toDate(value);
  return d ? format(d, 'd MMM yyyy', { locale: tr }) : '—';
};
export const formatRelative = (value: string | Date | null | undefined) => {
  const d = toDate(value);
  return d ? formatDistanceToNowStrict(d, { locale: tr, addSuffix: true }) : '—';
};

/** For `<input type="datetime-local">` */
export const toLocalInput = (value: string | Date | null | undefined) => {
  const d = toDate(value);
  return d ? format(d, "yyyy-MM-dd'T'HH:mm") : '';
};
export const fromLocalInput = (value: string | undefined | null) => (value ? new Date(value).toISOString() : null);

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const fullName = (u: { firstName?: string | null; lastName?: string | null; email?: string } | null | undefined) => {
  if (!u) return '—';
  const n = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return n || u.email || '—';
};

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };

export function slugify(input: string): string {
  return input
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR_MAP[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `MY-<PRODUCTSLUG>-<COLOR>-<SIZE>` — empty segments are skipped. */
export function buildSku(productSlug: string, colorSlug?: string | null, size?: string | null) {
  return ['MY', productSlug, colorSlug, size]
    .filter((s): s is string => Boolean(s && s.trim()))
    .map((s) => slugify(s).toUpperCase())
    .join('-');
}
