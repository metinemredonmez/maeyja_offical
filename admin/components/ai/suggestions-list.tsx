'use client';

import { ImagePlusIcon, PanelTopIcon, SparklesIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAddSuggestionAsBanner, useAddSuggestionToProduct, useDismissSuggestion, useSuggestions, type AiSuggestion } from '@/lib/queries/ai-studio';

const KIND_LABEL: Record<AiSuggestion['kind'], string> = { model: 'Mankende', scene: 'Arka plan', video: 'Video' };

/** AI results waiting for a decision (the automatic on-model shots of new products, and anything not placed yet). */
export function SuggestionsList({ productId, productNames, empty }: { productId?: string; productNames?: Record<string, string>; empty?: React.ReactNode }) {
  const list = useSuggestions({ productId, status: 'pending' });
  const toProduct = useAddSuggestionToProduct();
  const asBanner = useAddSuggestionAsBanner();
  const dismiss = useDismissSuggestion();
  const items = list.data ?? [];
  if (!items.length) return <>{empty ?? null}</>;

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <SparklesIcon className="size-4" /> AI önerileri — onayınızı bekliyor
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((s) => (
          <li key={s.id} className="flex flex-col gap-1.5 rounded-lg border bg-card p-2">
            <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
              {s.kind === 'video' ? (
                <video src={s.url} poster={s.sourceUrl ?? undefined} muted loop playsInline autoPlay className="size-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.url} alt="" className="size-full object-cover" loading="lazy" />
              )}
              <span className="absolute top-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px]">
                {KIND_LABEL[s.kind]}
                {s.auto ? ' · otomatik' : ''}
              </span>
            </div>
            {!productId && s.productId && productNames?.[s.productId] && <p className="truncate text-xs text-muted-foreground">{productNames[s.productId]}</p>}
            {s.productId && s.kind !== 'video' && (
              <Button type="button" size="sm" onClick={() => toProduct.mutate({ id: s.id, productId: s.productId! })} disabled={toProduct.isPending}>
                <ImagePlusIcon /> Ürüne ekle
              </Button>
            )}
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => asBanner.mutate(s.id)} disabled={asBanner.isPending}>
                <PanelTopIcon /> Banner
              </Button>
              <Button type="button" size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-[#A3121B]" onClick={() => dismiss.mutate(s.id)} aria-label="Öneriyi sil">
                <Trash2Icon />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
