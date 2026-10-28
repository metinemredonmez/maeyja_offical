'use client';

import { Suspense, useState } from 'react';
import { CopyIcon, FilmIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { Pagination, SearchInput } from '@/components/shared/data-table';
import { ImageUploader } from '@/components/shared/image-uploader';
import { isVideo } from '@/components/shared/media-picker';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime } from '@/components/shared/primitives';
import { EmptyState, ErrorState } from '@/components/shared/query-state';
import { useListParams } from '@/hooks/use-list-params';
import { formatBytes } from '@/lib/format';
import { useDeleteMedia, useMediaList, useUpdateMediaAlt } from '@/lib/queries/catalog';
import type { Media } from '@/lib/types';
import { cn } from '@/lib/utils';

function MediaCard({ m, selected, onSelect }: { m: Media; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={cn('group relative aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-inset ring-black/5 outline-none focus-visible:ring-2 focus-visible:ring-ring', selected && 'ring-2 ring-foreground')}>
      {isVideo(m) ? (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <FilmIcon className="size-6" />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.renditions?.['400'] ?? m.url} alt={m.alt ?? ''} className="size-full object-cover" loading="lazy" />
      )}
      {!m.alt && !isVideo(m) && <span className="absolute top-1 left-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">alt yok</span>}
    </button>
  );
}

function Details({ m, onClose }: { m: Media; onClose: () => void }) {
  const updateAlt = useUpdateMediaAlt();
  const del = useDeleteMedia();
  const confirm = useConfirm();
  const [alt, setAlt] = useState(m.alt ?? ''); // parent re-keys this component per media id
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success('Kopyalandı'));
  return (
    <aside className="space-y-3 rounded-xl border bg-card p-4">
      <div className="overflow-hidden rounded-lg bg-muted">
        {isVideo(m) ? (
          <video src={m.url} controls className="max-h-56 w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.renditions?.['800'] ?? m.url} alt={m.alt ?? ''} className="max-h-56 w-full object-contain" />
        )}
      </div>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Dosya</dt>
          <dd className="truncate font-mono">{m.key}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Tür · Boyut</dt>
          <dd>
            {m.mimeType} · {formatBytes(m.size)}
          </dd>
        </div>
        {m.width && m.height && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Ölçü</dt>
            <dd className="tabular-nums">
              {m.width} × {m.height}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Yüklendi</dt>
          <dd>
            <DateTime value={m.createdAt} />
          </dd>
        </div>
      </dl>
      <div>
        <label htmlFor="media-alt" className="text-xs font-medium">
          Alt metin
        </label>
        <div className="mt-1 flex gap-2">
          <Input id="media-alt" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} placeholder="Görseli tanımlayın" />
          <Button size="sm" variant="outline" disabled={alt === (m.alt ?? '') || updateAlt.isPending} onClick={() => updateAlt.mutate({ id: m.id, alt })}>
            Kaydet
          </Button>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium">Adresler</p>
        <ul className="mt-1 space-y-1">
          {Object.entries({ orijinal: m.url, ...(m.renditions ?? {}) }).map(([k, url]) => (
            <li key={k} className="flex items-center gap-2 text-xs">
              <span className="w-14 shrink-0 text-muted-foreground">{k === 'orijinal' ? k : `${k}px`}</span>
              <span className="min-w-0 flex-1 truncate font-mono">{url}</span>
              <Button variant="ghost" size="icon-xs" onClick={() => copy(url)} aria-label="Adresi kopyala">
                <CopyIcon />
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Kapat
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-[#A3121B]"
          onClick={() =>
            confirm.ask({
              title: 'Medya silinsin mi?',
              description: 'Dosya ve türevleri sunucudan kaldırılır. Bu görseli kullanan ürün/içeriklerde kırık görsel oluşur.',
              confirmLabel: 'Sil',
              destructive: true,
              onConfirm: async () => {
                await del.mutateAsync(m.id);
                onClose();
              },
            })
          }
        >
          <Trash2Icon /> Sil
        </Button>
      </div>
      {confirm.dialog}
    </aside>
  );
}

function MediaLibrary() {
  const { params, set, page, limit } = useListParams({ q: '', limit: '40' });
  const query = useMediaList({ page, limit, q: params.q || undefined });
  const [selected, setSelected] = useState<Media | null>(null);
  const current = query.data?.items.find((m) => m.id === selected?.id) ?? null;

  return (
    <>
      <PageHeader title="Medya" description={query.data ? `${query.data.total} dosya` : undefined} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <ImageUploader multiple onUploaded={(m) => setSelected(m)} />
          <SearchInput value={params.q} onChange={(q) => set({ q })} placeholder="Alt metinde ara…" />
          {query.isPending ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : query.data.items.length === 0 ? (
            <EmptyState title="Medya yok" description="Yukarıdan dosya yükleyin." />
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {query.data.items.map((m) => (
                <li key={m.id}>
                  <MediaCard m={m} selected={current?.id === m.id} onSelect={() => setSelected(m)} />
                </li>
              ))}
            </ul>
          )}
          {query.data && <Pagination page={page} limit={limit} total={query.data.total} onPageChange={(p) => set({ page: p })} />}
        </div>
        {current ? <Details key={current.id} m={current} onClose={() => setSelected(null)} /> :<div className="hidden rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground lg:block">Detay için bir dosya seçin</div>}
      </div>
    </>
  );
}

export default function MediaPage() {
  return (
    <Suspense fallback={null}>
      <MediaLibrary />
    </Suspense>
  );
}
