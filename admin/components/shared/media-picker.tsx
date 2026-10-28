'use client';

import { useState } from 'react';
import { CheckIcon, FilmIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Pagination, SearchInput } from '@/components/shared/data-table';
import { ImageUploader } from '@/components/shared/image-uploader';
import { EmptyState, ErrorState } from '@/components/shared/query-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaList } from '@/lib/queries/catalog';
import type { Media } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: Media) => void;
  title?: string;
};

export function isVideo(m: Pick<Media, 'mimeType'>) {
  return m.mimeType.startsWith('video/');
}

export function MediaGrid({ items, selectedId, onSelect, className }: { items: Media[]; selectedId?: string | null; onSelect: (m: Media) => void; className?: string }) {
  return (
    <ul className={cn('grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5', className)}>
      {items.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => onSelect(m)}
            aria-pressed={selectedId === m.id}
            className={cn('group relative block aspect-square w-full overflow-hidden rounded-lg bg-muted ring-1 ring-inset ring-black/5 outline-none focus-visible:ring-2 focus-visible:ring-ring', selectedId === m.id && 'ring-2 ring-foreground')}
            title={m.alt ?? m.key}
          >
            {isVideo(m) ? (
              <span className="flex size-full items-center justify-center text-muted-foreground">
                <FilmIcon className="size-6" />
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.renditions?.['400'] ?? m.url} alt={m.alt ?? ''} className="size-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
            )}
            {selectedId === m.id && (
              <span className="absolute top-1 right-1 rounded-full bg-foreground p-0.5 text-background">
                <CheckIcon className="size-3" />
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Dialog listing `/admin/media` with search + pagination, plus an upload tab. */
export function MediaPicker({ open, onOpenChange, onSelect, title = 'Medya seç' }: Props) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Media | null>(null);
  const query = useMediaList({ page, limit: 30, q: q || undefined }, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Kütüphaneden seçin veya yeni dosya yükleyin.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="library" className="gap-3">
          <TabsList>
            <TabsTrigger value="library">Kütüphane</TabsTrigger>
            <TabsTrigger value="upload">Yükle</TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="space-y-3">
            <SearchInput
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              placeholder="Alt metinde ara…"
            />
            <div className="max-h-[50vh] min-h-48 overflow-y-auto pr-1">
              {query.isPending ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square" />
                  ))}
                </div>
              ) : query.isError ? (
                <ErrorState error={query.error} onRetry={() => query.refetch()} />
              ) : query.data.items.length === 0 ? (
                <EmptyState title="Medya yok" description="Yükle sekmesinden dosya ekleyin." />
              ) : (
                <MediaGrid items={query.data.items} selectedId={selected?.id} onSelect={setSelected} />
              )}
            </div>
            {query.data && <Pagination page={query.data.page} limit={query.data.limit} total={query.data.total} onPageChange={setPage} />}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Vazgeç
              </Button>
              <Button
                disabled={!selected}
                onClick={() => {
                  if (selected) onSelect(selected);
                }}
              >
                Seç
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="upload">
            <ImageUploader multiple showResult onUploaded={(m) => onSelect(m)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/** Input + "Seç" button pair for a single image URL field. */
export function ImageUrlField({ value, onChange, placeholder, id, allowVideo }: { value: string | undefined; onChange: (url: string) => void; placeholder?: string; id?: string; allowVideo?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start gap-2">
      {value && !/\.(mp4|webm)$/i.test(value) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="size-16 shrink-0 rounded-md object-cover ring-1 ring-black/5" />
      ) : (
        <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">{value ? 'video' : 'yok'}</div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'https://… veya medyadan seçin'} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        <div className="flex gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Medyadan seç
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
              Kaldır
            </Button>
          )}
        </div>
      </div>
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        onSelect={(m) => {
          if (!allowVideo && isVideo(m)) return;
          onChange(m.url);
          setOpen(false);
        }}
      />
    </div>
  );
}
