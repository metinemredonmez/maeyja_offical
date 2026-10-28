'use client';

import Link from 'next/link';
import { ArrowDownRightIcon, ArrowUpRightIcon, BellIcon, MailIcon, PackageIcon, RotateCcwIcon, UsersIcon } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/shared/page-header';
import { ColorSwatch, DateTime, Money, Section } from '@/components/shared/primitives';
import { QueryState } from '@/components/shared/query-state';
import { StatusBadge, ToneBadge } from '@/components/shared/status-badge';
import { ORDER_STATUS, ORDER_STATUSES } from '@/lib/labels';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { useDashboard } from '@/lib/queries/system';
import type { RevenueBucket } from '@/lib/types';

function Kpi({ label, bucket, change }: { label: string; bucket: RevenueBucket; change?: number | null }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(bucket.total)}</p>
      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{formatNumber(bucket.orders)} sipariş</span>
        <span>·</span>
        <span>AOV {formatMoney(bucket.averageOrderValue)}</span>
        {change !== undefined && change !== null && (
          <span className={`ml-auto inline-flex items-center gap-0.5 font-medium ${change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {change >= 0 ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownRightIcon className="size-3" />}
            {Math.abs(change).toLocaleString('tr-TR')}%
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, href, icon, tone }: { label: string; value: number; href: string; icon: React.ReactNode; tone?: 'warning' | 'neutral' }) {
  return (
    <Link href={href} className={`flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50 ${tone === 'warning' && value > 0 ? 'border-amber-200 bg-amber-50/40' : 'bg-card'}`}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
      <div>
        <p className="text-lg leading-tight font-semibold tabular-nums">{formatNumber(value)}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}

type TooltipPayload = { payload?: { date: string; revenue: number; orders: number } }[];
function ChartTip({ active, payload }: { active?: boolean; payload?: TooltipPayload }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">{formatDate(row.date)}</p>
      <p className="text-muted-foreground">
        {formatMoney(row.revenue)} · {row.orders} sipariş
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const query = useDashboard();
  return (
    <>
      <PageHeader title="Panel" description="Ödenmiş siparişlere göre ciro; KDV dahil." />
      <QueryState query={query}>
        {(d) => {
          const data = d.daily.map((r) => ({ ...r, day: formatDate(r.date).replace(/ \d{4}$/, '') }));
          return (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <Kpi label="Bugün" bucket={d.revenue.today} />
                <Kpi label="Son 7 gün" bucket={d.revenue.last7Days} />
                <Kpi label="Son 30 gün" bucket={d.revenue.last30Days} change={d.revenue.changePct} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Stat label="Kargolanacak" value={d.toShip} href="/orders?status=PAID" icon={<PackageIcon className="size-4" />} tone="warning" />
                <Stat label="Bekleyen iade" value={d.pendingReturns} href="/returns?status=REQUESTED" icon={<RotateCcwIcon className="size-4" />} tone="warning" />
                <Stat label="Okunmamış mesaj" value={d.unreadMessages} href="/messages" icon={<MailIcon className="size-4" />} tone="warning" />
                <Stat label="Bülten abonesi" value={d.subscribers} href="/newsletter" icon={<BellIcon className="size-4" />} />
                <Stat label="Yeni müşteri (30g)" value={d.newCustomers30d} href="/customers" icon={<UsersIcon className="size-4" />} />
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <Section title="Son 30 gün ciro" className="lg:col-span-2">
                  <div className="h-56" role="img" aria-label="Son 30 günün günlük ciro grafiği">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1A1A1A" stopOpacity={0.12} />
                            <stop offset="100%" stopColor="#1A1A1A" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#E8E3DA" strokeDasharray="2 4" />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#737373' }} tickLine={false} axisLine={false} interval={6} />
                        <YAxis tick={{ fontSize: 10, fill: '#737373' }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                        <Tooltip content={<ChartTip />} cursor={{ stroke: '#A3A3A3', strokeWidth: 1 }} />
                        <Area type="monotone" dataKey="revenue" stroke="#1A1A1A" strokeWidth={2} fill="url(#rev)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-3 mb-1 text-xs text-muted-foreground">Günlük sipariş adedi</p>
                  <div className="h-20" role="img" aria-label="Son 30 günün günlük sipariş adedi">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                        <XAxis dataKey="day" hide />
                        <YAxis hide allowDecimals={false} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: '#F5F5F5' }} />
                        <Bar dataKey="orders" fill="#A3A3A3" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Section>

                <Section title="Sipariş durumları">
                  <ul className="space-y-1.5">
                    {ORDER_STATUSES.map((s) => (
                      <li key={s}>
                        <Link href={`/orders?status=${s}`} className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted">
                          <StatusBadge kind="order" value={s} />
                          <span className="tabular-nums">{formatNumber(d.statusCounts[s] ?? 0)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 mb-1 text-xs font-medium">En çok satan (30g)</p>
                  <ul className="space-y-1 text-sm">
                    {d.topProducts.length === 0 && <li className="text-xs text-muted-foreground">Henüz satış yok</li>}
                    {d.topProducts.map((p, i) => (
                      <li key={`${p.productId}-${i}`} className="flex items-center justify-between gap-2">
                        {p.productId ? (
                          <Link href={`/products/${p.productId}`} className="truncate hover:underline">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="truncate">{p.name}</span>
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {p.quantity} ad · {formatMoney(p.revenue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <Section
                  title="Son siparişler"
                  className="lg:col-span-2"
                  actions={
                    <Button variant="ghost" size="sm" render={<Link href="/orders" />}>
                      Tümü
                    </Button>
                  }
                >
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs">Sipariş</TableHead>
                        <TableHead className="text-xs">Müşteri</TableHead>
                        <TableHead className="text-xs">Durum</TableHead>
                        <TableHead className="text-right text-xs">Tutar</TableHead>
                        <TableHead className="text-right text-xs">Tarih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.recentOrders.length === 0 && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                            Henüz sipariş yok
                          </TableCell>
                        </TableRow>
                      )}
                      {d.recentOrders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell>
                            <Link href={`/orders/${o.id}`} className="font-medium tabular-nums hover:underline">
                              {o.orderNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-48 truncate text-muted-foreground">{o.email}</TableCell>
                          <TableCell>
                            <StatusBadge kind="order" value={o.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={o.total} />
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            <DateTime value={o.createdAt} mode="relative" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Section>

                <Section title="Düşük stok" description="Aktif ürünlerde stok ≤ 3">
                  <ul className="space-y-2">
                    {d.lowStock.length === 0 && <li className="text-xs text-muted-foreground">Düşük stoklu varyant yok</li>}
                    {d.lowStock.map((v) => (
                      <li key={v.variantId} className="flex items-center gap-2 text-sm">
                        {v.color && <ColorSwatch hex={v.color.hex} size="sm" />}
                        <Link href={`/products/${v.productId}`} className="min-w-0 flex-1 truncate hover:underline">
                          {v.productName}
                          {v.size ? ` · ${v.size}` : ''}
                        </Link>
                        <ToneBadge tone={v.stock === 0 ? 'danger' : 'warning'}>{v.stock} ad</ToneBadge>
                        {v.waitingAlerts > 0 && <span className="text-[10px] text-muted-foreground">{v.waitingAlerts} bekliyor</span>}
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>
              <p className="text-[11px] text-muted-foreground">{ORDER_STATUS.PAID.label} + {ORDER_STATUS.PROCESSING.label} siparişler kargolanacak olarak sayılır.</p>
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
