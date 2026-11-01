'use client';

import { useState } from 'react';
import { CameraIcon, CaptionsIcon, ImagesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AiEditDialog } from '@/components/ai/ai-edit-dialog';
import { InstagramDialog } from '@/components/ai/instagram-dialog';
import { Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api.client';
import { SuggestionsList } from '@/components/ai/suggestions-list';
import { SimpleSelect, SwitchField } from '@/components/shared/form';
import { MediaPicker } from '@/components/shared/media-picker';
import { PageHeader } from '@/components/shared/page-header';
import { Section } from '@/components/shared/primitives';
import { useProducts } from '@/lib/queries/catalog';
import { useSaveSetting, useSettings } from '@/lib/queries/system';

/**
 * AI stüdyo (Gemini): any photo of the site → another background, an on-model shot or a film; and the on-model
 * suggestions made for new products by themselves. Each product photo also has its own "AI" button.
 */
export default function AiStudioPage() {
  const settings = useSettings();
  const save = useSaveSetting();
  const products = useProducts({ page: 1, limit: 100 });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [productId, setProductId] = useState('');
  const autoModel = settings.data?.aiStudio?.autoModel ?? true;
  const reminder = settings.data?.cartReminder ?? { enabled: false, delayHours: 3 };
  const [insta, setInsta] = useState(false);
  const [alts, setAlts] = useState<string | null>(null);
  /** Alt text for the photos of every product, one product after the other. */
  const describeAll = async () => {
    let n = 0;
    try {
      for (const [i, p] of list.entries()) {
        setAlts(`${i + 1}/${list.length} · ${p.name}`);
        n += (await api.post<{ updated: number }>(`/admin/ai/alt/${p.id}`, {})).updated;
      }
      toast.success(`${n} fotoğrafa açıklama yazıldı`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setAlts(null);
    }
  };
  const list = products.data?.items ?? [];
  const names = Object.fromEntries(list.map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader title="AI stüdyo" description="Fotoğraftan yeni arka plan, mankenli çekim ya da video. Sonuçlar siz onaylamadan siteye çıkmaz." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Section title="Onay bekleyenler">
            <SuggestionsList productNames={names} empty={<p className="text-sm text-muted-foreground">Bekleyen öneri yok. Yeni ürün eklenince mankenli fotoğraf önerisi kendiliğinden burada belirir.</p>} />
          </Section>
        </div>
        <aside className="space-y-5">
          <Section title="Yeni üret">
            <div className="grid gap-3">
              <SimpleSelect
                value={productId}
                onChange={setProductId}
                allowEmpty
                emptyLabel="Ürün seçin (isteğe bağlı)"
                ariaLabel="Ürün"
                options={list.map((p) => ({ value: p.id, label: p.name }))}
              />
              <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
                <ImagesIcon /> Fotoğraf seç ve başla
              </Button>
              <p className="text-xs text-muted-foreground">
                Ürün seçerseniz çantanın diğer fotoğrafları da yapay zekâya örnek olur ve sonuç tek tuşla ürüne eklenir. Ürün sayfasında her fotoğrafın üstündeki “AI” tuşu da aynı işi yapar.
              </p>
            </div>
          </Section>
          <Section title="Hızlı işler">
            <div className="grid gap-2">
              <Button type="button" variant="outline" onClick={() => setInsta(true)} disabled={!productId}>
                <CameraIcon /> Instagram metni yaz
              </Button>
              <Button type="button" variant="outline" onClick={describeAll} disabled={Boolean(alts) || !list.length}>
                <CaptionsIcon /> {alts ? `Okunuyor ${alts}` : 'Bütün ürün fotoğraflarına açıklama yaz'}
              </Button>
              <p className="text-xs text-muted-foreground">Instagram metni için yukarıdan ürün seçin. Fotoğraf açıklamaları Google görsel aramasına ve ekran okuyuculara yarar; yalnızca hâlâ ürün adını taşıyanlar yazılır.</p>
            </div>
          </Section>
          <Section title="Otomatik">
            <SwitchField
              label="Yeni ürünlere manken önerisi"
              description="Fotoğrafı yüklenen her yeni ürün için gri stüdyoda mankenli bir fotoğraf hazırlanır ve burada onayınızı bekler."
              checked={autoModel}
              disabled={!settings.data || save.isPending}
              onCheckedChange={(v) => save.mutate({ key: 'aiStudio', value: { ...settings.data?.aiStudio, autoModel: v } })}
            />
            <div className="mt-4 grid gap-2 border-t pt-4">
              <SwitchField
                label="Sepet hatırlatma e-postası"
                description="Üye olup e-posta almayı kabul etmiş, sepetinde ürün bırakıp almamış müşteriye bir kez, kendi dilinde kısa bir hatırlatma gider (en geç iki gün içinde)."
                checked={reminder.enabled}
                disabled={!settings.data || save.isPending}
                onCheckedChange={(v) => save.mutate({ key: 'cartReminder', value: { ...reminder, enabled: v } })}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Kaç saat sonra
                <Input
                  type="number"
                  min={1}
                  max={47}
                  className="h-7 w-16"
                  defaultValue={reminder.delayHours}
                  key={reminder.delayHours}
                  onBlur={(e) => {
                    const h = Math.min(47, Math.max(1, Math.round(Number(e.target.value) || 3)));
                    if (h !== reminder.delayHours) save.mutate({ key: 'cartReminder', value: { ...reminder, delayHours: h } });
                  }}
                />
              </label>
            </div>
          </Section>
        </aside>
      </div>
      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Hangi fotoğraf?"
        onSelect={(m) => {
          if (m.mimeType.startsWith('video/')) return;
          setImage(m.url);
          setPickerOpen(false);
        }}
      />
      {insta && productId && <InstagramDialog open onOpenChange={setInsta} productId={productId} />}
      {image && (
        <AiEditDialog
          open
          onOpenChange={(o) => !o && setImage(null)}
          imageUrl={image}
          productId={productId || undefined}
        />
      )}
    </>
  );
}
