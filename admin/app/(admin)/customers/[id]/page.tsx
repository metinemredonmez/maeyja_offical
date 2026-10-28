'use client';

import { use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime, KeyValue, Money, Section } from '@/components/shared/primitives';
import { QueryState } from '@/components/shared/query-state';
import { StatusBadge, ToneBadge } from '@/components/shared/status-badge';
import { USER_ROLE } from '@/lib/labels';
import { formatMoney, fullName } from '@/lib/format';
import { useMe } from '@/lib/queries/auth';
import { useUpdateUser, useUser } from '@/lib/queries/users';

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useUser(id);
  const update = useUpdateUser();
  const me = useMe();
  const confirm = useConfirm();

  return (
    <QueryState query={query}>
      {(u) => {
        const isSelf = me.data?.id === u.id;
        const canToggle = !isSelf && (u.role === 'CUSTOMER' || me.data?.role === 'SUPER_ADMIN');
        return (
          <>
            <PageHeader
              title={
                <span className="flex items-center gap-2">
                  {fullName(u)} <StatusBadge kind="active" value={u.isActive} /> <ToneBadge tone={u.role === 'CUSTOMER' ? 'neutral' : 'info'}>{USER_ROLE[u.role]}</ToneBadge>
                </span>
              }
              description={u.email}
              backHref="/customers"
              backLabel="Müşteriler"
              actions={
                canToggle && (
                  <Button
                    variant="outline"
                    className={u.isActive ? 'text-[#A3121B]' : undefined}
                    disabled={update.isPending}
                    onClick={() =>
                      confirm.ask({
                        title: u.isActive ? 'Hesap pasife alınsın mı?' : 'Hesap aktifleştirilsin mi?',
                        description: u.isActive ? 'Kullanıcı giriş yapamaz; açık oturumları kapatılır. Siparişleri korunur.' : 'Kullanıcı yeniden giriş yapabilir.',
                        confirmLabel: u.isActive ? 'Pasife al' : 'Aktifleştir',
                        destructive: u.isActive,
                        onConfirm: () => update.mutateAsync({ id: u.id, body: { isActive: !u.isActive } }),
                      })
                    }
                  >
                    {u.isActive ? 'Pasife al' : 'Aktifleştir'}
                  </Button>
                )
              }
            />
            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
              <div className="space-y-5">
                <Section title="Profil">
                  <dl>
                    <KeyValue label="Ad">{fullName(u)}</KeyValue>
                    <KeyValue label="E-posta">
                      {u.email} {u.emailVerified ? <ToneBadge tone="success">doğrulandı</ToneBadge> : <ToneBadge tone="muted">doğrulanmadı</ToneBadge>}
                    </KeyValue>
                    <KeyValue label="Telefon">{u.phone ?? '—'}</KeyValue>
                    <KeyValue label="Dil">{u.locale.toUpperCase()}</KeyValue>
                    <KeyValue label="Pazarlama izni">{u.marketingOptIn ? 'Evet' : 'Hayır'}</KeyValue>
                    <KeyValue label="Kayıt">
                      <DateTime value={u.createdAt} />
                    </KeyValue>
                    <KeyValue label="Son giriş">
                      <DateTime value={u.lastLoginAt} />
                    </KeyValue>
                  </dl>
                </Section>
                <Section title="Toplam harcama" description="Ödenmiş siparişler">
                  <p className="text-3xl font-semibold tabular-nums">{formatMoney(u.totalSpent)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{u.orders.length} sipariş listeleniyor</p>
                </Section>
                <Section title={`Adresler (${u.addresses.length})`}>
                  {u.addresses.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Kayıtlı adres yok.</p>
                  ) : (
                    <ul className="space-y-3">
                      {u.addresses.map((a) => (
                        <li key={a.id} className="rounded-lg border p-3 text-sm">
                          <p className="flex items-center gap-2 font-medium">
                            {a.title ?? 'Adres'} {a.isDefault && <ToneBadge tone="neutral">varsayılan</ToneBadge>}
                          </p>
                          <p>
                            {a.firstName} {a.lastName} · {a.phone}
                          </p>
                          <p className="text-muted-foreground">
                            {a.line1}
                            {a.line2 ? `, ${a.line2}` : ''} — {a.district}, {a.city} {a.postalCode ?? ''} {a.country !== 'TR' ? a.country : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>
              <Section title="Siparişler" description="Son 20 sipariş">
                {u.orders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Henüz sipariş yok.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs">Sipariş</TableHead>
                        <TableHead className="text-xs">Durum</TableHead>
                        <TableHead className="text-right text-xs">Tutar</TableHead>
                        <TableHead className="text-right text-xs">Tarih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {u.orders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell>
                            <Link href={`/orders/${o.id}`} className="font-medium tabular-nums hover:underline">
                              {o.orderNumber}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <StatusBadge kind="order" value={o.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={o.total} />
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            <DateTime value={o.createdAt} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Section>
            </div>
            {confirm.dialog}
          </>
        );
      }}
    </QueryState>
  );
}
