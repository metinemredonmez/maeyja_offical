'use client';

import { use, useState } from 'react';
import { PencilIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CouponDialog } from '@/components/sales/coupon-dialog';
import { couponValue, couponWindow } from '@/components/sales/coupon-utils';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime, KeyValue, Money, Section } from '@/components/shared/primitives';
import { QueryState } from '@/components/shared/query-state';
import { COUPON_TYPE } from '@/lib/labels';
import { formatNumber } from '@/lib/format';
import { useCoupon } from '@/lib/queries/orders';

export default function CouponDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useCoupon(id);
  const [editing, setEditing] = useState(false);
  return (
    <QueryState query={query}>
      {(c) => {
        const usagePct = c.usageLimit ? Math.min(100, Math.round((c.usedCount / c.usageLimit) * 100)) : null;
        return (
          <>
            <PageHeader
              title={
                <span className="flex items-center gap-2 font-mono">
                  {c.code} {couponWindow(c)}
                </span>
              }
              description={c.description ?? COUPON_TYPE[c.type]}
              backHref="/coupons"
              backLabel="Kuponlar"
              actions={
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <PencilIcon /> Düzenle
                </Button>
              }
            />
            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
              <div className="space-y-5">
                <Section title="Kullanım">
                  <p className="text-3xl font-semibold tabular-nums">
                    {formatNumber(c.usedCount)}
                    {c.usageLimit && <span className="text-base font-normal text-muted-foreground"> / {formatNumber(c.usageLimit)}</span>}
                  </p>
                  {usagePct !== null && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={usagePct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-foreground" style={{ width: `${usagePct}%` }} />
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">{c.usageLimitPerUser ? `Kişi başı ${c.usageLimitPerUser} kullanım` : 'Kişi başı limit yok'}</p>
                </Section>
                <Section title="Kurallar">
                  <dl>
                    <KeyValue label="Tür">{COUPON_TYPE[c.type]}</KeyValue>
                    <KeyValue label="İndirim">{couponValue(c)}</KeyValue>
                    {c.maxDiscount != null && (
                      <KeyValue label="En fazla">
                        <Money value={c.maxDiscount} />
                      </KeyValue>
                    )}
                    <KeyValue label="Min. sipariş">{c.minOrderAmount != null ? <Money value={c.minOrderAmount} /> : '—'}</KeyValue>
                    <KeyValue label="Başlangıç">
                      <DateTime value={c.startsAt} />
                    </KeyValue>
                    <KeyValue label="Bitiş">
                      <DateTime value={c.endsAt} />
                    </KeyValue>
                    <KeyValue label="Oluşturuldu">
                      <DateTime value={c.createdAt} />
                    </KeyValue>
                  </dl>
                </Section>
              </div>
              <Section title="Son kullanımlar" description="En son 50 kullanım">
                {!c.redemptions?.length ? (
                  <p className="text-xs text-muted-foreground">Henüz kullanılmadı.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs">Tarih</TableHead>
                        <TableHead className="text-xs">E-posta</TableHead>
                        <TableHead className="text-xs">Sipariş</TableHead>
                        <TableHead className="text-right text-xs">Tutar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.redemptions.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">
                            <DateTime value={r.createdAt} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.email}</TableCell>
                          <TableCell className="font-mono text-xs">{r.order.orderNumber}</TableCell>
                          <TableCell className="text-right">
                            <Money value={r.order.total} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Section>
            </div>
            {editing && <CouponDialog coupon={c} onClose={() => setEditing(false)} />}
          </>
        );
      }}
    </QueryState>
  );
}
