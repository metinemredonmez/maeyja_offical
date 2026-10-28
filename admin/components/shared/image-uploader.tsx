'use client';

import { useCallback, useRef, useState } from 'react';
import { ImagePlusIcon, Loader2Icon, UploadCloudIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api.client';
import { catalogKeys, uploadMedia } from '@/lib/queries/catalog';
import { formatBytes } from '@/lib/format';
import type { Media } from '@/lib/types';
import { cn } from '@/lib/utils';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm';

type Props = {
  onUploaded: (media: Media) => void;
  multiple?: boolean;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
  /** Shows renditions of the last uploaded file under the drop zone. */
  showResult?: boolean;
};

/** Drag-drop / click to upload → `POST /api/admin/media`; returns the created Media. */
export function ImageUploader({ onUploaded, multiple, compact, className, disabled, showResult }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [last, setLast] = useState<Media | null>(null);

  const handleFiles = useCallback(
    async (list: FileList | File[]) => {
      const files = Array.from(list).filter((f) => ACCEPT.split(',').includes(f.type));
      if (!files.length) {
        toast.error('Desteklenen türler: JPG, PNG, WebP, AVIF, MP4, WebM');
        return;
      }
      const batch = multiple ? files : files.slice(0, 1);
      setBusy({ done: 0, total: batch.length });
      let ok = 0;
      for (const file of batch) {
        try {
          const media = await uploadMedia(file);
          ok++;
          setLast(media);
          onUploaded(media);
        } catch (e) {
          toast.error(`${file.name}: ${errorMessage(e)}`);
        }
        setBusy((b) => (b ? { ...b, done: b.done + 1 } : b));
      }
      setBusy(null);
      if (ok) {
        toast.success(ok === 1 ? 'Görsel yüklendi' : `${ok} dosya yüklendi`);
        qc.invalidateQueries({ queryKey: catalogKeys.media });
      }
    },
    [multiple, onUploaded, qc],
  );

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Dosya yükle"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          compact ? 'px-3 py-4' : 'px-6 py-8',
          dragging ? 'border-foreground bg-muted' : 'border-border hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {busy ? (
          <>
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Yükleniyor {busy.done}/{busy.total}
            </p>
          </>
        ) : (
          <>
            {compact ? <ImagePlusIcon className="size-5 text-muted-foreground" /> : <UploadCloudIcon className="size-6 text-muted-foreground" />}
            <p className="text-sm">
              Sürükleyip bırakın veya <span className="underline underline-offset-2">dosya seçin</span>
            </p>
            {!compact && <p className="text-xs text-muted-foreground">JPG, PNG, WebP, AVIF · MP4, WebM · en fazla 15 MB</p>}
          </>
        )}
        <input ref={inputRef} type="file" accept={ACCEPT} multiple={multiple} className="sr-only" tabIndex={-1} onChange={(e) => e.target.files && void handleFiles(e.target.files)} />
      </div>
      {showResult && last && (
        <div className="mt-2 flex items-center gap-3 rounded-lg border p-2 text-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={last.renditions?.['400'] ?? last.url} alt={last.alt ?? ''} className="size-12 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{last.key}</p>
            <p className="text-muted-foreground">
              {last.width && last.height ? `${last.width}×${last.height} · ` : ''}
              {formatBytes(last.size)}
            </p>
            {last.renditions && (
              <p className="mt-0.5 flex flex-wrap gap-1">
                {Object.keys(last.renditions).map((w) => (
                  <span key={w} className="rounded bg-muted px-1 tabular-nums">
                    {w}px
                  </span>
                ))}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setLast(null)}>
            Kapat
          </Button>
        </div>
      )}
    </div>
  );
}
