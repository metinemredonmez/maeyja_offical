'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLinkIcon, KeyRoundIcon, MonitorIcon, RotateCwIcon, SmartphoneIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STORE_URL } from '@/lib/format';
import { LOCALES, type Locale } from '@/lib/i18n';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useRotatePreviewToken, useSettings } from '@/lib/queries/system';
import { cn } from '@/lib/utils';

/** The shop is drawn at a real screen width and scaled down into the panel. */
const SCREEN = { desktop: { w: 1440, h: 0 }, phone: { w: 390, h: 844 } } as const;

/**
 * The shop's home page beside the editor, as visitors see it — also while the shop is closed for maintenance (the
 * staff preview link lets the frame in). It reloads whenever `version` changes: a section saved, moved, switched or
 * deleted.
 */
export function StorePreview({ version }: { version: string }) {
  const settings = useSettings();
  const token = settings.data?.maintenance.previewToken;
  const [device, setDevice] = useState<keyof typeof SCREEN>('desktop');
  const [locale, setLocale] = useState<Locale>('tr');
  const [reloads, setReloads] = useState(0);
  const [rotating, setRotating] = useState(false);
  const rotate = useRotatePreviewToken();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const path = locale === 'en' ? '/' : `/${locale}`;
  const src = token ? `${STORE_URL}${path}?preview=${token}` : null;
  const screen = SCREEN[device];
  const scale = device === 'desktop' ? size.w / screen.w : Math.min(1, size.w / screen.w, size.h / screen.h);
  const height = device === 'desktop' ? size.h / (scale || 1) : screen.h;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <span className="px-1 text-sm font-medium">Önizleme</span>
        <span className="mr-auto truncate text-xs text-muted-foreground">kaydedince yenilenir</span>
        <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} aria-label="Dil" className="h-7 rounded-md border bg-background px-1.5 text-xs uppercase">
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <Button variant={device === 'desktop' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setDevice('desktop')} aria-label="Bilgisayar">
          <MonitorIcon />
        </Button>
        <Button variant={device === 'phone' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setDevice('phone')} aria-label="Telefon">
          <SmartphoneIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setReloads((n) => n + 1)} aria-label="Yenile">
          <RotateCwIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setRotating(true)} aria-label="Önizleme anahtarını yenile" title="Önizleme anahtarını yenile">
          <KeyRoundIcon />
        </Button>
        <ConfirmDialog
          open={rotating}
          onOpenChange={setRotating}
          title="Önizleme anahtarı yenilensin mi?"
          description="Şimdiye kadar paylaşılan bütün önizleme bağlantıları çalışmaz olur (bakımdayken siteyi görebilmek için). Bu ekran yeni anahtarla devam eder."
          confirmLabel="Yenile"
          loading={rotate.isPending}
          onConfirm={() => rotate.mutateAsync().then(() => setRotating(false))}
        />
        {src ? (
          <Button variant="ghost" size="icon-sm" render={<a href={src} target="_blank" rel="noopener" />} aria-label="Yeni sekmede aç">
            <ExternalLinkIcon />
          </Button>
        ) : null}
      </div>
      <div ref={box} className={cn('relative min-h-0 flex-1 overflow-hidden', device === 'phone' && 'bg-muted/50')}>
        {src && scale > 0 ? (
          <iframe
            key={`${src}|${version}|${reloads}|${device}`}
            src={src}
            title="Mağaza önizlemesi"
            // The shop runs in the frame but may not navigate or open windows over the admin.
            sandbox="allow-scripts allow-same-origin allow-forms"
            referrerPolicy="no-referrer"
            style={{ width: screen.w, height, transform: `scale(${scale})` }}
            className={cn('absolute top-0 origin-top-left border-0 bg-white', device === 'desktop' ? 'left-0' : 'left-1/2 -translate-x-1/2 origin-top rounded-[28px] shadow-lg')}
          />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">{settings.isPending ? 'Yükleniyor…' : 'Önizleme için ayarları görme yetkisi gerekiyor.'}</p>
        )}
      </div>
    </div>
  );
}
