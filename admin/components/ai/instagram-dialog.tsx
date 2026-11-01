'use client';

import { useState } from 'react';
import { CopyIcon, Loader2Icon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { api, errorMessage } from '@/lib/api.client';

type Caption = { tr: string; en: string; hashtags: string[] };

function Copyable({ label, text }: { label: string; text: string }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => navigator.clipboard.writeText(text).then(() => toast.success('Kopyalandı'), () => toast.error('Kopyalanamadı'))}
        >
          <CopyIcon /> Kopyala
        </Button>
      </div>
      <p className="whitespace-pre-line rounded-md border bg-muted/40 px-3 py-2 text-sm">{text}</p>
    </div>
  );
}

/** "Instagram metni": a caption (Turkish and English) and hashtags for a product or a photo, ready to copy. */
export function InstagramDialog({ open, onOpenChange, productId, imageUrl }: { open: boolean; onOpenChange: (o: boolean) => void; productId?: string; imageUrl?: string }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState<Caption | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      setCaption(await api.post<Caption>('/admin/ai/caption', { productId, imageUrl, note: note.trim() || undefined }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Instagram metni</DialogTitle>
          <DialogDescription>Fotoğrafa ve ürüne bakarak Türkçe ve İngilizce paylaşım metni ile etiketler yazılır; kopyalayıp Instagram’a yapıştırırsınız.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="max-h-56 w-full rounded-md bg-muted object-contain" />
          )}
          <Textarea rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı: ör. yeni renk duyurusu, hafta sonu Beymen’de" />
          <Button type="button" onClick={run} disabled={busy}>
            {busy ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />} {caption ? 'Yeniden yaz' : 'Yaz'}
          </Button>
          {caption && (
            <>
              <Copyable label="Türkçe" text={caption.tr} />
              <Copyable label="English" text={caption.en} />
              <Copyable label="Etiketler" text={caption.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
