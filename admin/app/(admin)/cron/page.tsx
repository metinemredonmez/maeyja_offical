'use client';

import { useState } from 'react';
import { HistoryIcon, PlayIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime } from '@/components/shared/primitives';
import { ToneBadge } from '@/components/shared/status-badge';
import type { Tone } from '@/lib/labels';
import { useCronJobs, useCronRuns, useRunCronJob, useSystemStatus } from '@/lib/queries/cron';
import type { CronJobState, CronRun, HealthLevel } from '@/lib/types';

const size = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`);
const LEVEL_TONE: Record<HealthLevel, Tone> = { ok: 'success', warn: 'warning', fail: 'danger', off: 'muted' };

function Tile({ label, value, level, note }: { label: string; value: React.ReactNode; level?: HealthLevel; note?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {level && <ToneBadge tone={LEVEL_TONE[level]} dot>{{ ok: 'İyi', warn: 'Bakılmalı', fail: 'Acil', off: 'Kapalı' }[level]}</ToneBadge>}
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Disk, uploads, database and last night's backup; warnings also arrive as alerts. */
function ServerTiles() {
  const s = useSystemStatus();
  if (!s.data) return null;
  const { disk, uploads, databaseBytes, backup } = s.data;
  const pct = disk.total ? Math.round((disk.free / disk.total) * 100) : 0;
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="Disk boş alanı" value={size(disk.free)} level={disk.level} note={`%${pct} boş · toplam ${size(disk.total)}`} />
      <Tile label="Yüklenen dosyalar" value={size(uploads.bytes)} note={`${uploads.files.toLocaleString('tr-TR')} dosya`} />
      <Tile label="Veritabanı" value={size(databaseBytes)} note="Gelen kutusu ekleri dahil" />
      <Tile
        label="Son gece yedeği"
        level={backup.level}
        value={backup.finishedAt ? <DateTime value={backup.finishedAt} className="text-base" /> : '—'}
        note={!backup.configured ? 'Bu ortamda izlenmiyor' : backup.ok === false ? 'Son yedek hata verdi' : (backup.problem ?? (backup.bytes ? `Yedek klasörü ${size(backup.bytes)}` : undefined))}
      />
    </div>
  );
}

/** Jobs that write to customers: a hand start asks first. */
const SENDS_MAIL = new Set(['ai.cart-reminders', 'campaigns.resume']);

const every = (min: number) => (min < 60 ? `${min} dakikada bir` : min < 1440 ? (min === 60 ? 'saatte bir' : `${min / 60} saatte bir`) : 'günde bir');
const duration = (ms: number | null) => (ms === null ? '—' : ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)} sn` : `${Math.round(ms / 60_000)} dk`);

function state(j: CronJobState): { label: string; tone: Tone } {
  if (j.running) return { label: 'Çalışıyor', tone: 'info' };
  if (j.lateMin) return { label: `${j.lateMin} dk gecikti`, tone: 'danger' };
  if (j.lastStatus === 'error') return { label: j.failStreak > 1 ? `Hata (${j.failStreak} kez)` : 'Hata', tone: 'danger' };
  if (j.lastStatus === 'ok') return { label: 'Tamam', tone: 'success' };
  return { label: 'Henüz çalışmadı', tone: 'muted' };
}

function RunsDialog({ job, onClose }: { job: CronJobState; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const runs = useCronRuns({ name: job.name, page, limit: 20 });
  const columns: Column<CronRun>[] = [
    { key: 'at', header: 'Başlangıç', cell: (r) => <DateTime value={r.startedAt} className="text-xs" /> },
    { key: 'status', header: 'Sonuç', cell: (r) => <ToneBadge tone={r.status === 'ok' ? 'success' : 'danger'}>{r.status === 'ok' ? 'Tamam' : 'Hata'}</ToneBadge> },
    { key: 'trigger', header: 'Başlatan', cell: (r) => <span className="text-xs text-muted-foreground">{r.trigger === 'manual' ? 'Elle' : 'Zamanlayıcı'}</span> },
    { key: 'dur', header: 'Süre', align: 'right', cell: (r) => <span className="text-xs tabular-nums">{duration(r.durationMs)}</span> },
    {
      key: 'result',
      header: 'Ayrıntı',
      cell: (r) => (
        <span className="text-xs break-words text-muted-foreground">
          {r.error ??
            (r.result
              ? Object.entries(r.result)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(' · ')
              : '—')}
        </span>
      ),
    },
  ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{job.label}</DialogTitle>
          <DialogDescription>Hatalı ve elle başlatılan çalışmalar, iş yapanlar ve saatlik/günlük işlerin hepsi 30 gün saklanır.</DialogDescription>
        </DialogHeader>
        <DataTable
          columns={columns}
          rows={runs.data?.items}
          rowKey={(r) => r.id}
          total={runs.data?.total}
          page={page}
          limit={20}
          onPageChange={setPage}
          isLoading={runs.isPending}
          isFetching={runs.isFetching}
          error={runs.error}
          onRetry={() => runs.refetch()}
          emptyTitle="Kayıtlı çalışma yok"
          dense
        />
      </DialogContent>
    </Dialog>
  );
}

export default function CronPage() {
  const jobs = useCronJobs();
  const run = useRunCronJob();
  const confirm = useConfirm();
  const [history, setHistory] = useState<CronJobState | null>(null);

  const start = (j: CronJobState) =>
    SENDS_MAIL.has(j.name)
      ? confirm.ask({ title: `${j.label} şimdi çalışsın mı?`, description: 'Bu iş müşterilere e-posta gönderebilir.', confirmLabel: 'Çalıştır', onConfirm: () => run.mutateAsync(j.name) })
      : run.mutate(j.name);

  const columns: Column<CronJobState>[] = [
    {
      key: 'job',
      header: 'İş',
      cell: (j) => (
        <div className="min-w-0">
          <p className="text-sm font-medium">{j.label}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {j.name} · {every(j.everyMin)}
          </p>
        </div>
      ),
    },
    { key: 'state', header: 'Durum', cell: (j) => <ToneBadge tone={state(j).tone}>{state(j).label}</ToneBadge> },
    { key: 'last', header: 'Son çalışma', cell: (j) => (j.lastStartedAt ? <DateTime value={j.lastStartedAt} className="text-xs" /> : <span className="text-xs text-muted-foreground">—</span>) },
    { key: 'dur', header: 'Süre', align: 'right', cell: (j) => <span className="text-xs tabular-nums">{duration(j.lastDurationMs)}</span> },
    {
      key: 'error',
      header: 'Son hata',
      cell: (j) => (j.lastStatus === 'error' && j.lastError ? <span className="line-clamp-2 max-w-xs text-xs text-destructive">{j.lastError}</span> : <span className="text-xs text-muted-foreground">—</span>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (j) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setHistory(j)}>
            <HistoryIcon /> Geçmiş
          </Button>
          <Button variant="ghost" size="sm" disabled={!!j.running || run.isPending} onClick={() => start(j)}>
            <PlayIcon /> Çalıştır
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Zamanlanmış işler"
        description="Sunucunun durumu ve arka planda kendiliğinden çalışan işler. Biri hata verirse ya da beklenen sürede çalışmazsa Uyarılar'a düşer ve e-posta gelir."
      />
      <ServerTiles />
      <DataTable
        columns={columns}
        rows={jobs.data}
        rowKey={(j) => j.name}
        isLoading={jobs.isPending}
        isFetching={jobs.isFetching}
        error={jobs.error}
        onRetry={() => jobs.refetch()}
        emptyTitle="İş yok"
      />
      {history && <RunsDialog job={history} onClose={() => setHistory(null)} />}
      {confirm.dialog}
    </>
  );
}
