'use client';

import { Suspense, useState } from 'react';
import { CheckCheckIcon, CheckIcon, SendIcon, SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Field } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime } from '@/components/shared/primitives';
import { ToneBadge } from '@/components/shared/status-badge';
import { useListParams } from '@/hooks/use-list-params';
import type { Tone } from '@/lib/labels';
import { useAlertCatalog, useAlerts, useResolveAlert, useResolveAllAlerts, useTestAlerts } from '@/lib/queries/alerts';
import { useSaveSetting, useSettings } from '@/lib/queries/system';
import { cn } from '@/lib/utils';
import type { Alert, AlertLevel, Settings } from '@/lib/types';

const MASK = '••••';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBHOOK = /^https:\/\/(hooks\.slack\.com|discord\.com|discordapp\.com|chat\.googleapis\.com)\//;

const LEVEL: Record<AlertLevel, { label: string; tone: Tone }> = {
  CRITICAL: { label: 'Acil', tone: 'danger' },
  WARNING: { label: 'Uyarı', tone: 'warning' },
  INFO: { label: 'Bilgi', tone: 'muted' },
};
const STATUSES = [
  { value: 'open', label: 'Açık' },
  { value: 'resolved', label: 'Çözülen' },
  { value: 'all', label: 'Tümü' },
] as const;
type Status = (typeof STATUSES)[number]['value'];

/** Who hears about alerts: an e-mail address, an optional chat webhook, and the alerts that stay in the panel only. */
function RecipientsDialog({ value, onClose }: { value: Settings['alerts']; onClose: () => void }) {
  const [draft, setDraft] = useState(value);
  const catalog = useAlertCatalog();
  const save = useSaveSetting();
  // A saved webhook comes back as "••••abcd": the field stays empty, and left empty it keeps the saved one.
  const saved = value.webhookUrl.startsWith(MASK) ? value.webhookUrl : '';
  const webhookShown = draft.webhookUrl.startsWith(MASK) ? '' : draft.webhookUrl;
  const emailBad = draft.email !== '' && !EMAIL.test(draft.email);
  const webhookBad = webhookShown !== '' && !WEBHOOK.test(webhookShown);
  const mutable = (catalog.data ?? []).filter((c) => c.level !== 'INFO');
  const toggleMuted = (code: string, muted: boolean) => setDraft({ ...draft, muted: muted ? [...draft.muted, code] : draft.muted.filter((c) => c !== code) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Uyarı alıcıları</DialogTitle>
          <DialogDescription>Uyarı ve acil seviyesindeki sorunlar buraya gider. Bilgi seviyesindekiler yalnız bu sayfada görünür.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
          <Field label="E-posta" htmlFor="al-email" hint="Boş bırakılırsa sunucudaki yönetici adresine (ADMIN_NOTIFY_EMAIL) gider." error={emailBad ? 'Geçerli bir e-posta girin' : undefined}>
            <Input id="al-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value.trim() })} placeholder="ornek@alanadi.com" />
          </Field>
          <Field
            label="Sohbet kanalı (opsiyonel)"
            htmlFor="al-webhook"
            hint="Slack, Discord ya da Google Chat'te kanala bir “gelen webhook” ekleyip adresini yapıştırın. Adres gizli tutulur."
            error={webhookBad ? 'Yalnız Slack, Discord ya da Google Chat webhook adresi (https://)' : undefined}
          >
            <div className="flex gap-2">
              {/* Masked with CSS, not type="password": a password field gets the admin's saved password filled in. */}
              <Input
                id="al-webhook"
                name="mj-alert-webhook"
                autoComplete="off"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                className="font-mono text-xs [-webkit-text-security:disc]"
                placeholder={saved && draft.webhookUrl ? `Kayıtlı ${saved} · değiştirmek için yenisini yapıştırın` : 'https://hooks.slack.com/services/…'}
                value={webhookShown}
                onChange={(e) => setDraft({ ...draft, webhookUrl: e.target.value.trim() || (saved && draft.webhookUrl ? saved : '') })}
              />
              {saved && draft.webhookUrl && (
                <Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...draft, webhookUrl: '' })}>
                  Kaldır
                </Button>
              )}
            </div>
          </Field>
          <div className="space-y-2">
            <p className="text-sm font-medium">Gönderilsin</p>
            <p className="text-xs text-muted-foreground">İşareti kaldırılan uyarılar yine bu sayfada görünür, yalnız e-posta ve webhook ile gönderilmez.</p>
            <div className="grid gap-1.5">
              {mutable.map((c) => (
                <label key={c.code} className="flex items-start gap-2 text-sm">
                  <Checkbox checked={!draft.muted.includes(c.code)} onCheckedChange={(on) => toggleMuted(c.code, !on)} className="mt-0.5" />
                  <span>
                    <span className="text-muted-foreground">{c.group} · </span>
                    {c.title}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button disabled={emailBad || webhookBad || save.isPending} onClick={() => save.mutate({ key: 'alerts', value: draft }, { onSuccess: onClose })}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AlertList() {
  const { params, set, page, limit } = useListParams({ status: 'open', q: '' });
  const status = (STATUSES.some((s) => s.value === params.status) ? params.status : 'open') as Status;
  const query = useAlerts({ page, limit, status, q: params.q || undefined });
  const resolve = useResolveAlert();
  const resolveAll = useResolveAllAlerts();
  const test = useTestAlerts();
  const confirm = useConfirm();
  const settings = useSettings();
  const [recipients, setRecipients] = useState(false);

  const columns: Column<Alert>[] = [
    { key: 'level', header: 'Seviye', cell: (a) => <ToneBadge tone={LEVEL[a.level].tone}>{LEVEL[a.level].label}</ToneBadge> },
    {
      key: 'alert',
      header: 'Uyarı',
      cell: (a) => (
        <div className={cn('min-w-0 max-w-xl', a.resolvedAt && 'opacity-60')}>
          <p className="text-sm font-medium">{a.title}</p>
          <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{a.detail}</p>
        </div>
      ),
    },
    { key: 'key', header: 'Kayıt', cell: (a) => <span className="font-mono text-[11px] text-muted-foreground">{a.key || '—'}</span> },
    { key: 'count', header: 'Kaç kez', align: 'right', cell: (a) => <span className="text-xs tabular-nums">{a.count}</span> },
    { key: 'last', header: 'Son görülme', cell: (a) => <DateTime value={a.lastAt} className="text-xs" /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (a) =>
        a.resolvedAt ? (
          <span className="text-xs text-muted-foreground">{a.resolvedById ? 'Çözüldü' : 'Kendiliğinden düzeldi'}</span>
        ) : (
          <Button variant="ghost" size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate(a.id)}>
            <CheckIcon /> Çözüldü
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Uyarılar"
        description="Ödeme sorunları, duran işler, dolan kotalar ve şüpheli girişler. Uyarı ve acil olanlar e-postayla da gelir; aynı sorun açık kaldıkça tekrar tekrar gönderilmez."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!settings.data} onClick={() => setRecipients(true)}>
              <SettingsIcon /> Alıcılar
            </Button>
            <Button variant="outline" size="sm" disabled={test.isPending} onClick={() => test.mutate()}>
              <SendIcon /> Deneme gönder
            </Button>
            {status === 'open' && (query.data?.total ?? 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  confirm.ask({
                    title: 'Bütün açık uyarılar çözüldü sayılsın mı?',
                    description: 'Sorun sürüyorsa aynı uyarı yeniden açılır ve tekrar e-posta gelir.',
                    confirmLabel: 'Hepsini kapat',
                    onConfirm: () => resolveAll.mutateAsync(),
                  })
                }
              >
                <CheckCheckIcon /> Hepsini kapat
              </Button>
            )}
          </div>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(a) => a.id}
        total={query.data?.total}
        page={page}
        limit={limit}
        onPageChange={(p) => set({ page: p })}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        emptyTitle={status === 'open' ? 'Açık uyarı yok' : 'Uyarı yok'}
        search={{ value: params.q, onChange: (q) => set({ q }), placeholder: 'Uyarı, sipariş no…' }}
        toolbar={
          <div className="flex gap-1">
            {STATUSES.map((s) => (
              <Button key={s.value} variant={status === s.value ? 'secondary' : 'ghost'} size="sm" onClick={() => set({ status: s.value, page: 1 })}>
                {s.label}
              </Button>
            ))}
          </div>
        }
      />
      {recipients && settings.data && <RecipientsDialog value={settings.data.alerts} onClose={() => setRecipients(false)} />}
      {confirm.dialog}
    </>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={null}>
      <AlertList />
    </Suspense>
  );
}
