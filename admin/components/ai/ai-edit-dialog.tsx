'use client';

import { useRef, useState } from 'react';
import { DownloadIcon, ImagePlusIcon, Loader2Icon, PanelTopIcon, RotateCcwIcon, SparklesIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { SimpleSelect } from '@/components/shared/form';
import { errorMessage } from '@/lib/api.client';
import {
  runStudio,
  useAddSuggestionAsBanner,
  useAddSuggestionToProduct,
  useDismissSuggestion,
  useMarkSuggestionUsed,
  type AiSuggestion,
  type Carry,
  type StudioKind,
} from '@/lib/queries/ai-studio';
import { cn } from '@/lib/utils';

/** Ready-made backgrounds; a click writes the wish into the box, where it can be changed. */
const SCENES = [
  { label: 'Masa üstü', text: 'açık renk ceviz bir masanın üstünde, arkada sade, yumuşak bej bir duvar; doğal gün ışığı' },
  { label: 'Traverten', text: 'açık traverten taşın üstünde, arkada sıcak sıva duvar, soldan ikindi güneşi ve yumuşak pencere gölgesi' },
  { label: 'Mermer', text: 'beyaz-gri damarlı mermer bir sehpanın üstünde, arkası sade ve aydınlık' },
  { label: 'Stüdyo gri', text: 'düz, eşit ışıklı açık gri stüdyo zemini ve fonu, renk tam olarak #F2F2F2' },
  { label: 'Keten', text: 'buruşuk krem keten kumaşın üstünde, yumuşak gün ışığı' },
  { label: 'Roma sokağı', text: "Roma'da güneşli, taş döşeli eski bir sokakta alçak bir taş duvarın üstünde; arka plan hafif flu" },
];
const CARRY: { value: Carry; label: string }[] = [
  { value: 'auto', label: 'Çantaya göre (otomatik)' },
  { value: 'hand', label: 'Elde, sapından' },
  { value: 'strap', label: 'Elde, kısa askısı yumrukta' },
  { value: 'shoulder', label: 'Omuzda, askısıyla' },
  { value: 'underarm', label: 'Koltuk altında' },
];
const KINDS: { value: StudioKind; label: string; hint: string }[] = [
  { value: 'scene', label: 'Arka planı değiştir', hint: 'Çanta aynı kalır; sadece altındaki zemin ve arkası değişir.' },
  { value: 'model', label: 'Mankene giydir', hint: 'Gri stüdyoda, siyah kıyafetli bir manken çantayı taşır (ürün sayfalarındaki gibi).' },
  { value: 'video', label: 'Video yap', hint: 'Bu fotoğraftan sakin, kısa bir film (birkaç dakika sürer).' },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  /** Set on a product page: the bag's other photos guide the AI and "Ürüne ekle" is offered. */
  productId?: string;
  kinds?: StudioKind[];
  defaultKind?: StudioKind;
  /** Offered as "Bu alanda kullan" (e.g. a homepage section's photo or video field). */
  onUse?: (s: AiSuggestion) => void;
  useLabel?: string;
};

/**
 * "AI ile düzenle" for one photo (Gemini): another background described in plain Turkish, an on-model shot, or a
 * film. The result waits here to be added to the product, put on the homepage as a banner, used in the open form,
 * downloaded or thrown away — nothing reaches the shop by itself.
 */
export function AiEditDialog({ open, onOpenChange, imageUrl, productId, kinds = ['scene', 'model', 'video'], defaultKind, onUse, useLabel = 'Bu alanda kullan' }: Props) {
  const [kind, setKind] = useState<StudioKind>(defaultKind ?? kinds[0]);
  const [wish, setWish] = useState('');
  const [carry, setCarry] = useState<Carry>('auto');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const toProduct = useAddSuggestionToProduct();
  const asBanner = useAddSuggestionAsBanner();
  const used = useMarkSuggestionUsed();
  const dismiss = useDismissSuggestion();

  const close = (o: boolean) => {
    if (!o) abort.current?.abort();
    onOpenChange(o);
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    abort.current = new AbortController();
    try {
      const s = await runStudio({ kind, imageUrl, productId, carry: kind === 'model' ? carry : undefined, note: wish.trim() || undefined }, abort.current.signal);
      setResult(s);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    setResult(null);
    close(false);
  };
  const isVideo = result?.kind === 'video';
  const current = KINDS.find((k) => k.value === kind)!;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4" /> AI ile düzenle
          </DialogTitle>
          <DialogDescription>Ne istediğinizi Türkçe yazın. Çantanın kendisi hiç değiştirilmez; beğenmezseniz silin, yeniden deneyin.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <figure className="space-y-1">
            <div className="overflow-hidden rounded-lg border bg-muted">
              {isVideo ? (
                <video src={result.url} poster={imageUrl} controls autoPlay muted loop playsInline className="max-h-[460px] w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result ? result.url : imageUrl} alt="" className="max-h-[460px] w-full object-contain" />
              )}
            </div>
            <figcaption className="text-xs text-muted-foreground">{result ? 'Sonuç' : 'Kaynak fotoğraf'}</figcaption>
          </figure>

          <div className="flex flex-col gap-3">
            {!result && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {KINDS.filter((k) => kinds.includes(k.value)).map((k) => (
                    <Button key={k.value} type="button" size="sm" variant={kind === k.value ? 'default' : 'outline'} onClick={() => setKind(k.value)} disabled={busy}>
                      {k.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{current.hint}</p>

                {kind === 'scene' && (
                  <div className="flex flex-wrap gap-1.5">
                    {SCENES.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        disabled={busy}
                        onClick={() => setWish(s.text)}
                        className={cn('rounded-full border px-2.5 py-1 text-xs hover:bg-muted', wish === s.text && 'border-foreground bg-muted')}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
                {kind === 'model' && <SimpleSelect value={carry} onChange={(v) => setCarry(v as Carry)} options={CARRY} ariaLabel="Nasıl taşısın" />}

                <Textarea
                  rows={4}
                  maxLength={400}
                  value={wish}
                  onChange={(e) => setWish(e.target.value)}
                  disabled={busy}
                  placeholder={
                    kind === 'scene' ? 'Ör. bu çantayı ahşap bir masanın üstüne koy, yanında bir fincan kahve olsun' : kind === 'model' ? 'İsteğe bağlı: ör. krem bir trençkot giysin' : 'İsteğe bağlı: ör. saçları rüzgârda hafifçe uçuşsun'
                  }
                />
                {error && <p className="rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-800">{error}</p>}
                <Button type="button" onClick={generate} disabled={busy || (kind === 'scene' && !wish.trim())}>
                  {busy ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                  {busy ? (kind === 'video' ? 'Video hazırlanıyor… (birkaç dakika)' : 'Hazırlanıyor… (yaklaşık yarım dakika)') : 'Oluştur'}
                </Button>
                {busy && <p className="text-xs text-muted-foreground">Pencereyi kapatabilirsiniz; sonuç AI stüdyo sayfasında da görünür.</p>}
              </>
            )}

            {result && (
              <div className="flex flex-col gap-2">
                <p className="text-sm">Beğendiyseniz nereye koyalım?</p>
                {productId && !isVideo && (
                  <Button type="button" onClick={() => toProduct.mutate({ id: result.id, productId }, { onSuccess: finish })} disabled={toProduct.isPending}>
                    <ImagePlusIcon /> Ürünün fotoğraflarına ekle
                  </Button>
                )}
                {onUse && (
                  <Button
                    type="button"
                    variant={productId && !isVideo ? 'outline' : 'default'}
                    onClick={() =>
                      used.mutate(result.id, {
                        onSuccess: () => {
                          onUse(result);
                          toast.success('Forma eklendi — kaydetmeyi unutmayın');
                          finish();
                        },
                      })
                    }
                  >
                    <ImagePlusIcon /> {useLabel}
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => asBanner.mutate(result.id, { onSuccess: finish })} disabled={asBanner.isPending}>
                  <PanelTopIcon /> Ana sayfaya banner olarak ekle
                </Button>
                <Button type="button" variant="outline" render={<a href={result.url} download target="_blank" rel="noreferrer" />}>
                  <DownloadIcon /> İndir
                </Button>
                <div className="mt-2 flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setResult(null)}>
                    <RotateCcwIcon /> Yeniden dene
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-[#A3121B]" onClick={() => dismiss.mutate(result.id, { onSuccess: () => setResult(null) })}>
                    <Trash2Icon /> Beğenmedim, sil
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
