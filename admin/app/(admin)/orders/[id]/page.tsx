'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLinkIcon, TruckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Field, FormError, SimpleSelect, SubmitButton, SwitchField } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime, KeyValue, Money, Section, Thumb } from '@/components/shared/primitives';
import { QueryState } from '@/components/shared/query-state';
import { StatusBadge, ToneBadge } from '@/components/shared/status-badge';
import { ORDER_STATUS, PAYMENT_PROVIDER } from '@/lib/labels';
import { fullName } from '@/lib/format';
import { useOrder, useOrderNote, useShipOrder, useUpdateOrderStatus } from '@/lib/queries/orders';
import { shipSchema, statusChangeSchema, type ShipValues, type StatusChangeValues } from '@/lib/schemas/orders';
import type { OrderAddress, OrderDetail, OrderStatus } from '@/lib/types';

function AddressBlock({ a }: { a: OrderAddress }) {
  return (
    <address className="text-sm not-italic leading-relaxed">
      <p className="font-medium">
        {a.firstName} {a.lastName}
      </p>
      <p>{a.line1}</p>
      {a.line2 && <p>{a.line2}</p>}
      <p>
        {a.district && `${a.district}, `}
        {a.city} {a.postalCode}
        {a.country && a.country !== 'TR' ? ` · ${a.country}` : ''}
      </p>
      {a.phone && <p className="text-muted-foreground">{a.phone}</p>}
    </address>
  );
}

/** Rendered with `key={target}` so the form re-initialises per transition. */
function StatusDialog({ order, target, onClose }: { order: OrderDetail; target: OrderStatus; onClose: () => void }) {
  const update = useUpdateOrderStatus(order.id);
  const wasShipped = order.status === 'SHIPPED' || order.status === 'DELIVERED';
  const showRestock = target === 'REFUNDED' && wasShipped;
  const showProvider = (target === 'CANCELLED' || target === 'REFUNDED') && order.paymentProvider === 'IYZICO';
  const showNotify = target === 'PAID' || target === 'CANCELLED';
  const form = useForm<StatusChangeValues>({ resolver: zodResolver(statusChangeSchema), defaultValues: { status: target, note: '', restock: false, refundOnProvider: false, notifyCustomer: true } });
  const onSubmit = form.handleSubmit(async (raw) => {
    const v = statusChangeSchema.parse(raw);
    await update.mutateAsync({ status: v.status, note: v.note, restock: showRestock ? v.restock : undefined, refundOnProvider: showProvider ? v.refundOnProvider : undefined, notifyCustomer: showNotify ? v.notifyCustomer : undefined });
    onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Durumu güncelle → <StatusBadge kind="order" value={target} />
          </DialogTitle>
          <DialogDescription>
            {ORDER_STATUS[order.status].label} → {ORDER_STATUS[target].label}
            {target === 'CANCELLED' || (target === 'REFUNDED' && !wasShipped) ? ' · Rezerve stok geri alınır, kupon kullanımı iade edilir.' : ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3" noValidate>
          <FormError error={update.error} />
          <Field label="Not (zaman çizelgesine yazılır)" error={form.formState.errors.note} htmlFor="status-note">
            <Textarea id="status-note" rows={3} maxLength={500} {...form.register('note')} />
          </Field>
          {showRestock && <Controller control={form.control} name="restock" render={({ field }) => <SwitchField label="Stoğa geri ekle" description="Ürün geri geldiyse stok adedini artırır" checked={field.value} onCheckedChange={field.onChange} />} />}
          {showProvider && <Controller control={form.control} name="refundOnProvider" render={({ field }) => <SwitchField label="iyzico’da ödemeyi iptal et" description="Aynı gün içindeki ödemeler iptal edilebilir; sonrası için iyzico panelinden iade yapın" checked={field.value} onCheckedChange={field.onChange} />} />}
          {showNotify && <Controller control={form.control} name="notifyCustomer" render={({ field }) => <SwitchField label="Müşteriye e-posta gönder" checked={field.value} onCheckedChange={field.onChange} />} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <SubmitButton loading={update.isPending} className={target === 'CANCELLED' || target === 'REFUNDED' ? 'bg-[#A3121B] text-white hover:bg-[#8c0f17]' : undefined}>
              {ORDER_STATUS[target].label} olarak işaretle
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShipDialog({ order, open, onClose }: { order: OrderDetail; open: boolean; onClose: () => void }) {
  const ship = useShipOrder(order.id);
  const defaultCarrier = order.carriers.find((c) => c.name === order.carrier)?.code ?? order.carriers[0]?.code ?? '';
  const form = useForm<ShipValues>({ resolver: zodResolver(shipSchema), defaultValues: { carrier: defaultCarrier, trackingNumber: order.trackingNumber ?? '', trackingUrl: '', notifyCustomer: order.status !== 'SHIPPED' } });
  const carrier = form.watch('carrier');
  const tracking = form.watch('trackingNumber');
  const customUrl = form.watch('trackingUrl');
  const preview = useMemo(() => {
    if (customUrl) return customUrl;
    const c = order.carriers.find((x) => x.code === carrier);
    return c && tracking ? c.trackingUrl.replace('{tracking}', encodeURIComponent(tracking.trim())) : '';
  }, [carrier, tracking, customUrl, order.carriers]);
  const onSubmit = form.handleSubmit(async (raw) => {
    const v = shipSchema.parse(raw);
    await ship.mutateAsync({ carrier: v.carrier, trackingNumber: v.trackingNumber, trackingUrl: v.trackingUrl, notifyCustomer: v.notifyCustomer });
    onClose();
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{order.status === 'SHIPPED' ? 'Kargo bilgisini düzelt' : 'Kargoya ver'}</DialogTitle>
          <DialogDescription>Sipariş “Kargoda” durumuna geçer; müşteriye takip bağlantısı gönderilir.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3" noValidate>
          <FormError error={ship.error} />
          <Field label="Kargo firması" error={form.formState.errors.carrier} htmlFor="carrier" required>
            <Controller control={form.control} name="carrier" render={({ field }) => <SimpleSelect id="carrier" value={field.value} onChange={field.onChange} options={order.carriers.map((c) => ({ value: c.code, label: c.name }))} placeholder="Seçin" />} />
          </Field>
          <Field label="Takip numarası" error={form.formState.errors.trackingNumber} htmlFor="trackingNumber" required>
            <Input id="trackingNumber" className="font-mono" maxLength={64} autoFocus {...form.register('trackingNumber')} />
          </Field>
          <Field label="Takip adresi (opsiyonel)" error={form.formState.errors.trackingUrl} htmlFor="trackingUrl" hint="Boşsa firmanın şablonundan üretilir">
            <Input id="trackingUrl" placeholder="https://…" maxLength={500} {...form.register('trackingUrl')} />
          </Field>
          {preview && (
            <p className="truncate rounded-lg bg-muted/60 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Önizleme: </span>
              <a href={preview} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {preview}
              </a>
            </p>
          )}
          <Controller control={form.control} name="notifyCustomer" render={({ field }) => <SwitchField label="Müşteriye bildir" description="E-posta + varsa mobil push" checked={field.value} onCheckedChange={field.onChange} />} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <SubmitButton loading={ship.isPending}>
              <TruckIcon /> Kaydet
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdminNote({ order }: { order: OrderDetail }) {
  const save = useOrderNote(order.id);
  const [note, setNote] = useState(order.adminNote ?? ''); // parent re-keys per order id
  return (
    <Section title="Yönetici notu" description="Odak kaybında otomatik kaydedilir; müşteri görmez.">
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (order.adminNote ?? '') && save.mutate(note)} rows={4} maxLength={2000} placeholder="İç not…" aria-label="Yönetici notu" />
      {save.isPending && <p className="mt-1 text-xs text-muted-foreground">Kaydediliyor…</p>}
    </Section>
  );
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useOrder(id);
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [shipOpen, setShipOpen] = useState(false);

  return (
    <QueryState query={query}>
      {(order) => {
        const bill = order.billingAddress;
        const invoice = bill.invoiceType ? bill : null;
        return (
          <>
            <PageHeader
              title={
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{order.orderNumber}</span>
                  <StatusBadge kind="order" value={order.status} />
                </span>
              }
              description={
                <>
                  <DateTime value={order.createdAt} /> · {PAYMENT_PROVIDER[order.paymentProvider]} · {order.locale.toUpperCase()}
                </>
              }
              backHref="/orders"
              backLabel="Siparişler"
              actions={
                <>
                  {(order.allowedTransitions.includes('SHIPPED') || order.status === 'SHIPPED') && (
                    <Button onClick={() => setShipOpen(true)}>
                      <TruckIcon /> {order.status === 'SHIPPED' ? 'Kargo bilgisini düzelt' : 'Kargoya ver'}
                    </Button>
                  )}
                  {order.allowedTransitions
                    .filter((s) => s !== 'SHIPPED')
                    .map((s) => (
                      <Button key={s} variant="outline" size="sm" className={s === 'CANCELLED' || s === 'REFUNDED' ? 'text-[#A3121B]' : undefined} onClick={() => setTarget(s)}>
                        {ORDER_STATUS[s].label}
                      </Button>
                    ))}
                </>
              }
            />

            <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
              <div className="space-y-5">
                <Section title={`Ürünler (${order.items.length})`}>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs">Ürün</TableHead>
                        <TableHead className="text-xs">SKU</TableHead>
                        <TableHead className="text-right text-xs">Birim</TableHead>
                        <TableHead className="text-right text-xs">Adet</TableHead>
                        <TableHead className="text-right text-xs">Toplam</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Thumb src={it.imageUrl} alt={it.productName} />
                              <div className="min-w-0">
                                {it.productId ? (
                                  <Link href={`/products/${it.productId}`} className="font-medium hover:underline">
                                    {it.productName}
                                  </Link>
                                ) : (
                                  <p className="font-medium">{it.productName}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {[it.colorName, it.size].filter(Boolean).join(' · ') || it.variantName || ''} {it.taxRate ? `· KDV %${it.taxRate}` : ''}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{it.sku}</TableCell>
                          <TableCell className="text-right">
                            <Money value={it.unitPrice} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                          <TableCell className="text-right">
                            <Money value={it.lineTotal} className="font-medium" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <dl className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Ara toplam</dt>
                      <dd>
                        <Money value={order.subtotal} />
                      </dd>
                    </div>
                    {Number(order.discountTotal) > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">İndirim {order.couponCode && <span className="font-mono text-xs">({order.couponCode})</span>}</dt>
                        <dd>
                          -<Money value={order.discountTotal} />
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Kargo</dt>
                      <dd>{Number(order.shippingTotal) === 0 ? 'Ücretsiz' : <Money value={order.shippingTotal} />}</dd>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <dt>KDV (dahil)</dt>
                      <dd>
                        <Money value={order.taxTotal} />
                      </dd>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-base font-semibold">
                      <dt>Toplam</dt>
                      <dd>
                        <Money value={order.total} />
                      </dd>
                    </div>
                  </dl>
                </Section>

                <Section title="Ödemeler">
                  {order.payments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Ödeme kaydı yok.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs">Tarih</TableHead>
                          <TableHead className="text-xs">Yöntem</TableHead>
                          <TableHead className="text-xs">Durum</TableHead>
                          <TableHead className="text-xs">Kart</TableHead>
                          <TableHead className="text-right text-xs">Tutar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs">
                              <DateTime value={p.createdAt} />
                            </TableCell>
                            <TableCell className="text-xs">{PAYMENT_PROVIDER[p.provider]}</TableCell>
                            <TableCell>
                              <StatusBadge kind="payment" value={p.status} />
                              {p.failureReason && <p className="mt-0.5 text-[11px] text-rose-700">{p.failureReason}</p>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {p.cardAssociation ?? ''} {p.cardLast4 ? `•••• ${p.cardLast4}` : '—'} {p.installment && p.installment > 1 ? `· ${p.installment} taksit` : ''}
                            </TableCell>
                            <TableCell className="text-right">
                              <Money value={p.amount} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Section>

                {order.returnRequests.length > 0 && (
                  <Section
                    title="İade talepleri"
                    actions={
                      <Button variant="ghost" size="sm" render={<Link href="/returns" />}>
                        İadeler
                      </Button>
                    }
                  >
                    <ul className="space-y-2">
                      {order.returnRequests.map((r) => (
                        <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                          <div>
                            <p className="font-medium">{r.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.items.map((i) => `${order.items.find((x) => x.id === i.orderItemId)?.productName ?? 'Ürün'} ×${i.quantity}`).join(', ')} · <DateTime value={r.createdAt} mode="date" />
                            </p>
                            {r.adminNote && <p className="mt-1 text-xs">Not: {r.adminNote}</p>}
                          </div>
                          <StatusBadge kind="return" value={r.status} />
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                <Section title="Zaman çizelgesi">
                  <ol className="relative ml-2 space-y-4 border-l pl-5">
                    <li className="relative text-sm">
                      <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-muted-foreground/40 ring-4 ring-background" />
                      <p>Sipariş oluşturuldu</p>
                      <p className="text-xs text-muted-foreground">
                        <DateTime value={order.createdAt} />
                        {order.customerNote && <> · Müşteri notu: “{order.customerNote}”</>}
                      </p>
                    </li>
                    {order.history.map((h) => (
                      <li key={h.id} className="relative text-sm">
                        <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-foreground ring-4 ring-background" />
                        <p className="flex flex-wrap items-center gap-1.5">
                          {h.from && (
                            <>
                              <StatusBadge kind="order" value={h.from} /> →
                            </>
                          )}
                          <StatusBadge kind="order" value={h.to} />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <DateTime value={h.createdAt} /> · {h.actor ? fullName(h.actor) : 'Sistem'}
                          {h.note && <> · {h.note}</>}
                        </p>
                      </li>
                    ))}
                  </ol>
                </Section>
              </div>

              <aside className="space-y-5">
                <Section title="Müşteri">
                  <div className="text-sm">
                    {order.user ? (
                      <Link href={`/customers/${order.user.id}`} className="font-medium hover:underline">
                        {fullName(order.user)}
                      </Link>
                    ) : (
                      <p className="font-medium">
                        {order.shippingAddress.firstName} {order.shippingAddress.lastName} <ToneBadge tone="muted">misafir</ToneBadge>
                      </p>
                    )}
                    <p className="text-muted-foreground">{order.email}</p>
                    {order.phone && <p className="text-muted-foreground">{order.phone}</p>}
                    {order.user && <p className="mt-1 text-xs text-muted-foreground">{order.user._count.orders} sipariş · üye <DateTime value={order.user.createdAt} mode="date" /></p>}
                  </div>
                </Section>
                <Section title="Teslimat adresi">
                  <AddressBlock a={order.shippingAddress} />
                  {order.carrier && (
                    <div className="mt-3 rounded-lg bg-muted/60 p-2 text-xs">
                      <p className="font-medium">{order.carrier}</p>
                      <p className="font-mono">{order.trackingNumber}</p>
                      {order.trackingUrl && (
                        <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 underline underline-offset-2">
                          Takip <ExternalLinkIcon className="size-3" />
                        </a>
                      )}
                    </div>
                  )}
                </Section>
                <Section title="Fatura">
                  <AddressBlock a={order.billingAddress} />
                  {invoice && (
                    <dl className="mt-3 border-t pt-2">
                      <KeyValue label="Tür">{invoice.invoiceType === 'CORPORATE' ? 'Kurumsal' : 'Bireysel'}</KeyValue>
                      {invoice.companyName && <KeyValue label="Firma">{invoice.companyName}</KeyValue>}
                      {invoice.taxOffice && <KeyValue label="Vergi dairesi">{invoice.taxOffice}</KeyValue>}
                      {(invoice.taxNumber || invoice.identityNumber) && <KeyValue label={invoice.taxNumber ? 'VKN' : 'TCKN'}>{invoice.taxNumber ?? invoice.identityNumber}</KeyValue>}
                    </dl>
                  )}
                </Section>
                <AdminNote key={order.id} order={order} />
                <dl className="rounded-xl border bg-card p-4 text-xs">
                  <KeyValue label="Ödendi">
                    <DateTime value={order.paidAt} />
                  </KeyValue>
                  <KeyValue label="Kargolandı">
                    <DateTime value={order.shippedAt} />
                  </KeyValue>
                  <KeyValue label="Teslim">
                    <DateTime value={order.deliveredAt} />
                  </KeyValue>
                  {order.cancelledAt && (
                    <KeyValue label="İptal">
                      <DateTime value={order.cancelledAt} />
                    </KeyValue>
                  )}
                </dl>
              </aside>
            </div>

            {target && <StatusDialog key={target} order={order} target={target} onClose={() => setTarget(null)} />}
            {shipOpen && <ShipDialog order={order} open onClose={() => setShipOpen(false)} />}
          </>
        );
      }}
    </QueryState>
  );
}
