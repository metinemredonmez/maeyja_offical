'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CopyIcon, Loader2Icon, SendIcon, Share2Icon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { api, errorMessage } from '@/lib/api.client';
import { cn } from '@/lib/utils';

type Caption = { tr: string; en: string; hashtags: string[] };

const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success('Kopyalandı'), () => toast.error('Kopyalanamadı'));

/** The photo as a JPEG file, ready for the phone's share sheet (Instagram takes JPEG, not WebP). */
async function jpegFile(url: string): Promise<File | null> {
  try {
    const blob = await (await fetch(url, { mode: 'cors' })).blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0);
    const jpeg = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    return jpeg ? new File([jpeg], 'maeyja.jpg', { type: 'image/jpeg' }) : null;
  } catch {
    return null;
  }
}

/**
 * "Instagram metni": a caption (Turkish and English) and hashtags for a product photo, then either
 * - "Telefondan paylaş": the phone's share sheet opens with the photo, the text is copied to paste in Instagram; or
 * - "Instagram'da yayınla": posted straight to the shop's account (once the account is connected on the server).
 */
export function InstagramDialog({ open, onOpenChange, productId, images = [], imageUrl }: { open: boolean; onOpenChange: (o: boolean) => void; productId?: string; images?: string[]; imageUrl?: string }) {
  // Opened with only a product (AI stüdyo): its photos are fetched to choose from.
  const product = useQuery({
    queryKey: ['products', 'detail', productId],
    queryFn: () => api.get<{ images: { url: string }[] }>(`/admin/products/${productId}`),
    enabled: Boolean(productId) && !images.length && !imageUrl,
  });
  const choices = images.length ? images : imageUrl ? [imageUrl] : (product.data?.images.map((i) => i.url) ?? []);
  const [picked, setImage] = useState<string | undefined>(imageUrl);
  const image = picked ?? choices[0];
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState<Caption | null>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const confirm = useConfirm();
  const account = useQuery({ queryKey: ['instagram-status'], queryFn: () => api.get<{ connected: boolean; username?: string }>('/admin/instagram/status'), staleTime: 5 * 60_000 });

  // Prepared ahead: a phone only opens its share sheet straight from the tap.
  useEffect(() => {
    let live = true;
    setFile(null);
    if (image) void jpegFile(image).then((f) => live && setFile(f));
    return () => {
      live = false;
    };
  }, [image]);

  const write = async () => {
    setBusy(true);
    try {
      const c = await api.post<Caption>('/admin/ai/caption', { productId, imageUrl: image, note: note.trim() || undefined });
      setCaption(c);
      setText(`${c.tr}\n\n${c.en}\n\n${c.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const canShare = Boolean(file && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] }));
  const share = () => {
    if (!file) return;
    void navigator.clipboard.writeText(text).catch(() => undefined);
    navigator
      .share({ files: [file] })
      .then(() => toast.success('Metin kopyalandı — Instagram’da açıklamaya yapıştırın'))
      .catch((e: Error) => e.name !== 'AbortError' && toast.error('Paylaşım açılamadı'));
  };

  const publish = () =>
    confirm.ask({
      title: 'Instagram’da yayınlansın mı?',
      description: `Seçili fotoğraf bu metinle${account.data?.username ? ` @${account.data.username}` : ''} hesabında hemen yayınlanır.`,
      confirmLabel: 'Yayınla',
      onConfirm: async () => {
        setPublishing(true);
        try {
          const r = await api.post<{ permalink?: string }>('/admin/instagram/publish', { imageUrl: image, caption: text });
          toast.success('Instagram’da yayınlandı', r.permalink ? { action: { label: 'Gör', onClick: () => window.open(r.permalink, '_blank') } } : undefined);
          onOpenChange(false);
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setPublishing(false);
        }
      },
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Instagram</DialogTitle>
          <DialogDescription>Fotoğrafı seçin, metni yazdırın; sonra telefondan paylaşın ya da doğrudan yayınlayın.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {choices.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {choices.map((u) => (
                <button key={u} type="button" onClick={() => setImage(u)} className={cn('size-16 shrink-0 overflow-hidden rounded-md border-2', u === image ? 'border-foreground' : 'border-transparent opacity-70')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="max-h-64 w-full rounded-md bg-muted object-contain" />
          )}
          <Textarea rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı not: ör. yeni renk, hafta sonu Beymen’de" />
          <Button type="button" variant={caption ? 'outline' : 'default'} onClick={write} disabled={busy}>
            {busy ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />} {caption ? 'Yeniden yaz' : 'Metni yaz'}
          </Button>

          {caption && (
            <>
              <div className="grid gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Paylaşılacak metin (düzeltebilirsiniz)</p>
                  <Button type="button" size="sm" variant="ghost" onClick={() => copy(text)}>
                    <CopyIcon /> Kopyala
                  </Button>
                </div>
                <Textarea rows={9} maxLength={2200} value={text} onChange={(e) => setText(e.target.value)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={share} disabled={!canShare}>
                  <Share2Icon /> Telefondan paylaş
                </Button>
                <Button type="button" onClick={publish} disabled={!account.data?.connected || publishing || !text.trim()}>
                  {publishing ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Instagram’da yayınla
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {canShare ? 'Telefondan paylaş: fotoğraf Instagram’da açılır, metin kopyalanır; açıklamaya yapıştırın.' : 'Telefondan paylaş: admin’i telefonda açınca çalışır.'}{' '}
                {account.data?.connected
                  ? `Yayınla: @${account.data.username ?? 'hesap'} hesabına doğrudan gider.`
                  : 'Yayınla: Instagram bağlantısı henüz kurulmadı (AI stüdyo sayfasında nasıl yapılacağı yazıyor).'}
              </p>
            </>
          )}
        </div>
        {confirm.dialog}
      </DialogContent>
    </Dialog>
  );
}
