'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCwIcon, UnplugIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Field } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime, Section } from '@/components/shared/primitives';
import { QueryState } from '@/components/shared/query-state';
import { ToneBadge } from '@/components/shared/status-badge';
import { api } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';

type Connection = { connected: false } | { connected: true; accountId: string; accountName: string; currency: string; tokenHint: string; savedAt: string };
type Campaign = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchaseValue: number;
};
type Overview =
  | { connected: false }
  | {
      connected: true;
      range: Range;
      account: { id: string; name: string; currency: string; active: boolean; amountSpent: number | null; spendCap: number | null };
      totals: { spend: number; impressions: number; clicks: number; metaPurchases: number; metaPurchaseValue: number; shopOrders: number; shopRevenue: number; roas: number | null };
      campaigns: Campaign[];
      fetchedAt: string;
    };
type Range = '7d' | '30d' | '90d';

const KEYS = { connection: ['ads', 'connection'] as const, overview: (r: Range) => ['ads', 'overview', r] as const };
const RANGES: { value: Range; label: string }[] = [
  { value: '7d', label: 'Son 7 gün' },
  { value: '30d', label: 'Son 30 gün' },
  { value: '90d', label: 'Son 90 gün' },
];
const STATUS: Record<string, { label: string; tone: 'success' | 'muted' | 'warning' | 'danger' }> = {
  ACTIVE: { label: 'Yayında', tone: 'success' },
  PAUSED: { label: 'Duraklatıldı', tone: 'muted' },
  CAMPAIGN_PAUSED: { label: 'Duraklatıldı', tone: 'muted' },
  ARCHIVED: { label: 'Arşivde', tone: 'muted' },
  DELETED: { label: 'Silindi', tone: 'muted' },
  IN_PROCESS: { label: 'İşleniyor', tone: 'warning' },
  WITH_ISSUES: { label: 'Sorunlu', tone: 'danger' },
};
const number = (n: number) => n.toLocaleString('tr-TR');

/** The steps in Meta's own words, and the two boxes. The token is kept encrypted on the server and never shown again. */
function Connect() {
  const [token, setToken] = useState('');
  const [account, setAccount] = useState('');
  const connect = useApiMutation<Connection, void>({
    mutationFn: () => api.put('/admin/ads/connection', { accessToken: token.trim(), adAccountId: account.trim() }),
    invalidate: [['ads']],
    success: 'Meta reklam hesabı bağlandı',
  });
  return (
    <Section title="Meta reklam hesabını bağla" description="Panel yalnız okur: kampanyalar, harcama ve sonuçlar. Para Meta'da kalır; ödeme Ads Manager'daki kart ya da bakiyeden yapılır.">
      <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
        <li>
          <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener" className="underline">
            Meta İşletme ayarları → Kullanıcılar → Sistem kullanıcıları
          </a>{' '}
          → <b>Ekle</b> (rol: Çalışan). Sonra <b>Varlık ata</b> → Reklam hesapları → hesabınızı seçip <b>Performansı görüntüle</b> yetkisini verin.
        </li>
        <li>
          Aynı sistem kullanıcısında <b>Yeni token oluştur</b> → uygulamanızı seçin → izin olarak <b>ads_read</b> işaretleyin → süresi “Asla dolmaz” → tokenı kopyalayın.
        </li>
        <li>
          Reklam hesabı numarası:{' '}
          <a href="https://adsmanager.facebook.com" target="_blank" rel="noopener" className="underline">
            Ads Manager
          </a>
          &apos;da sol üstte hesap adının yanındaki numara (act_ ile ya da onsuz).
        </li>
      </ol>
      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <Field label="Erişim tokenı" htmlFor="meta-token" hint="Sunucuda şifreli saklanır, bir daha gösterilmez.">
          {/* Masked with CSS, not type="password": a password field gets the admin's saved password filled in. */}
          <Input
            id="meta-token"
            name="mj-meta-token"
            autoComplete="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            className="font-mono text-xs [-webkit-text-security:disc]"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="EAA…"
          />
        </Field>
        <Field label="Reklam hesabı numarası" htmlFor="meta-account">
          <Input id="meta-account" className="font-mono" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="act_1234567890" />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button disabled={!token.trim() || !account.trim() || connect.isPending} onClick={() => connect.mutate()}>
          {connect.isPending ? 'Kontrol ediliyor…' : 'Bağla'}
        </Button>
      </div>
    </Section>
  );
}

function Tile({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function Dashboard({ connection }: { connection: Extract<Connection, { connected: true }> }) {
  const [range, setRange] = useState<Range>('30d');
  const [fresh, setFresh] = useState(0);
  const overview = useQuery({ queryKey: [...KEYS.overview(range), fresh], queryFn: () => api.get<Overview>(`/admin/ads/overview?range=${range}${fresh ? '&fresh=true' : ''}`) });
  const disconnect = useApiMutation({ mutationFn: () => api.delete('/admin/ads/connection'), invalidate: [['ads']], success: 'Bağlantı kaldırıldı' });
  const confirm = useConfirm();
  const data = overview.data?.connected ? overview.data : null;
  const money = (n: number | null | undefined) =>
    n == null ? '—' : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: data?.account.currency || connection.currency || 'TRY', maximumFractionDigits: 0 }).format(n);

  const columns: Column<Campaign>[] = [
    { key: 'name', header: 'Kampanya', cell: (c) => <span className="text-sm font-medium">{c.name}</span> },
    { key: 'status', header: 'Durum', cell: (c) => <ToneBadge tone={STATUS[c.status]?.tone ?? 'muted'}>{STATUS[c.status]?.label ?? c.status}</ToneBadge> },
    { key: 'budget', header: 'Bütçe', cell: (c) => <span className="text-xs">{c.dailyBudget != null ? `${money(c.dailyBudget)} / gün` : c.lifetimeBudget != null ? `${money(c.lifetimeBudget)} toplam` : '—'}</span> },
    { key: 'spend', header: 'Harcama', align: 'right', cell: (c) => <span className="text-xs tabular-nums">{money(c.spend)}</span> },
    { key: 'clicks', header: 'Tıklama', align: 'right', cell: (c) => <span className="text-xs tabular-nums">{number(c.clicks)}</span> },
    { key: 'purchases', header: 'Satın alma (Meta)', align: 'right', cell: (c) => <span className="text-xs tabular-nums">{c.purchases ? `${number(c.purchases)} · ${money(c.purchaseValue)}` : '—'}</span> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Button key={r.value} variant={range === r.value ? 'secondary' : 'ghost'} size="sm" onClick={() => setRange(r.value)}>
              {r.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {data ? (
            <>
              <span>
                Güncellendi <DateTime value={data.fetchedAt} />
              </span>
              <Button variant="ghost" size="sm" onClick={() => setFresh((n) => n + 1)} disabled={overview.isFetching}>
                <RefreshCwIcon /> Yenile
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <QueryState query={overview}>
        {() =>
          data ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Tile label="Harcama" value={money(data.totals.spend)} note={`${number(data.totals.impressions)} gösterim · ${number(data.totals.clicks)} tıklama`} />
                <Tile label="Satın alma (Meta'ya göre)" value={number(data.totals.metaPurchases)} note={money(data.totals.metaPurchaseValue)} />
                <Tile label="Reklamdan gelen siparişler (sitede)" value={number(data.totals.shopOrders)} note={money(data.totals.shopRevenue)} />
                <Tile label="ROAS (sitedeki ciro / harcama)" value={data.totals.roas != null ? `${data.totals.roas.toLocaleString('tr-TR')}×` : '—'} note="1'in üstü: reklam harcadığından fazla getirdi" />
              </div>
              <Section title="Kampanyalar" description="Meta'daki kampanyalar ve seçili dönemdeki sonuçları. Kampanyalar şimdilik Ads Manager'dan kurulup değiştirilir.">
                <DataTable columns={columns} rows={data.campaigns} rowKey={(c) => c.id} emptyTitle="Bu hesapta kampanya yok" dense />
              </Section>
            </div>
          ) : null
        }
      </QueryState>
      <Section
        title="Hesap"
        actions={
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-[#A3121B]"
            onClick={() =>
              confirm.ask({
                title: 'Meta bağlantısı kaldırılsın mı?',
                description: 'Kayıtlı token silinir; reklamlarınız Meta’da aynen devam eder.',
                confirmLabel: 'Kaldır',
                destructive: true,
                onConfirm: () => disconnect.mutateAsync(),
              })
            }
          >
            <UnplugIcon /> Bağlantıyı kaldır
          </Button>
        }
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Reklam hesabı</dt>
            <dd>
              {data?.account.name ?? connection.accountName} <span className="font-mono text-xs text-muted-foreground">{connection.accountId}</span>
              {data && !data.account.active ? <ToneBadge tone="danger" className="ml-2">Hesap etkin değil</ToneBadge> : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Toplam harcanan / harcama tavanı</dt>
            <dd>
              {money(data?.account.amountSpent)} / {data?.account.spendCap ? money(data.account.spendCap) : 'tavan yok (Ads Manager → Ödeme ayarları)'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Token</dt>
            <dd className="font-mono text-xs">
              {connection.tokenHint} · <DateTime value={connection.savedAt} mode="date" />
            </dd>
          </div>
        </dl>
      </Section>
      {confirm.dialog}
    </div>
  );
}

/**
 * Pazarlama → Reklamlar (phase 1 of the plan: connect and watch). Meta's numbers next to the shop's own: the orders
 * of visitors who clicked a Meta ad. Setting ads up from here and AI suggestions come later.
 */
export default function AdsPage() {
  const connection = useQuery({ queryKey: KEYS.connection, queryFn: () => api.get<Connection>('/admin/ads/connection') });
  return (
    <>
      <PageHeader title="Reklamlar" description="Instagram ve Facebook reklamlarının harcaması ve getirisi. Reklamdan gelen siparişler, çerez onayı veren ve bir Meta reklamına tıklayarak gelen ziyaretçilerden sayılır." />
      <QueryState query={connection}>{(c) => (c.connected ? <Dashboard connection={c} /> : <Connect />)}</QueryState>
    </>
  );
}
