import { Money } from '@/components/shared/primitives';
import { StatusBadge, ToneBadge } from '@/components/shared/status-badge';
import type { Coupon } from '@/lib/types';

export function couponValue(c: Coupon) {
  if (c.type === 'PERCENT') return `%${Number(c.value)}`;
  if (c.type === 'FIXED') return <Money value={c.value} />;
  return 'Kargo bedava';
}

export function couponWindow(c: Coupon) {
  const now = Date.now();
  if (!c.isActive) return <ToneBadge tone="muted">pasif</ToneBadge>;
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return <ToneBadge tone="neutral">başlamadı</ToneBadge>;
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return <ToneBadge tone="muted">süresi doldu</ToneBadge>;
  if (c.usageLimit && c.usedCount >= c.usageLimit) return <ToneBadge tone="warning">limit doldu</ToneBadge>;
  return <StatusBadge kind="active" value />;
}
