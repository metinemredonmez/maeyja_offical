'use client';

import { RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { api } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import { useQuery } from '@tanstack/react-query';

type TryonAvatar = { id: string; key: string; imageUrl: string; createdAt: string; _count: { looks: number } };

/** Turkish for the parts of an avatar's key ("average-slim-medium-brown-long"; backend tryon-avatar.ts). */
const WORDS: Record<string, string> = {
  petite: '160 cm ve altı',
  average: '161–172 cm',
  tall: '173 cm ve üstü',
  slim: 'ince',
  regular: 'orta',
  curvy: 'dolgun',
  fair: 'çok açık ten',
  light: 'açık ten',
  medium: 'buğday ten',
  tan: 'esmer ten',
  deep: 'koyu ten',
  blonde: 'sarı',
  brown: 'kahverengi',
  black: 'siyah',
  red: 'kızıl',
  short: 'kısa saç',
  long: 'uzun saç',
};
const describe = (key: string) => key.split('-').map((w) => WORDS[w] ?? w).join(' · ');

const KEY = ['tryon-avatars'] as const;

/**
 * "Üzerimde gör → Avatar oluştur": every avatar visitors were shown, each made once for a set of choices. A poor one
 * is deleted and made again by the next visitor who picks the same. After new product photos, the bags placed on the
 * avatars can be cleared so they are made again from the new photos.
 */
export function TryonAvatars() {
  const list = useQuery({ queryKey: KEY, queryFn: () => api.get<TryonAvatar[]>('/admin/ai/avatars') });
  const remove = useApiMutation<unknown, string>({ mutationFn: (id) => api.delete(`/admin/ai/avatars/${id}`), invalidate: [KEY], success: 'Avatar silindi' });
  const clearLooks = useApiMutation<{ removed: number }>({
    mutationFn: () => api.delete<{ removed: number }>('/admin/ai/avatars/looks'),
    invalidate: [KEY],
    success: (r) => `${r.removed} çanta görseli silindi; sıradaki istekte yeni fotoğraflardan yapılacak`,
  });
  const confirm = useConfirm();
  const avatars = list.data ?? [];

  return (
    <div className="space-y-3">
      {avatars.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {avatars.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-lg border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.imageUrl} alt="" className="aspect-[3/4] w-full bg-muted object-cover" />
              <div className="flex items-start justify-between gap-1 p-2">
                <div className="min-w-0 text-xs">
                  <p className="leading-snug">{describe(a.key)}</p>
                  <p className="mt-0.5 text-muted-foreground">{a._count.looks} çanta görseli</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Avatarı sil"
                  title="Avatarı sil"
                  className="shrink-0 text-muted-foreground hover:text-[#A3121B]"
                  onClick={() =>
                    confirm.ask({
                      title: 'Avatar silinsin mi?',
                      description: 'Bu avatar ve üzerindeki çanta görselleri silinir. Aynı seçimi yapan bir sonraki ziyaretçi için yenisi üretilir.',
                      confirmLabel: 'Sil',
                      destructive: true,
                      onConfirm: () => remove.mutateAsync(a.id),
                    })
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {list.isPending ? 'Yükleniyor…' : 'Henüz avatar yok. Ürün sayfasında “See it on me → Avatar oluştur” ilk kullanıldığında burada görünür.'}
        </p>
      )}
      {avatars.length ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={clearLooks.isPending}
          onClick={() =>
            confirm.ask({
              title: 'Çanta görselleri yeniden yapılsın mı?',
              description: 'Avatarlar kalır; üzerlerindeki çanta görselleri silinir ve sıradaki istekte güncel ürün fotoğraflarından yeniden yapılır. Ürün fotoğrafları değiştiyse kullanın.',
              confirmLabel: 'Yeniden yap',
              onConfirm: () => clearLooks.mutateAsync(),
            })
          }
        >
          <RefreshCwIcon /> Çanta görsellerini yenile
        </Button>
      ) : null}
      {confirm.dialog}
    </div>
  );
}
