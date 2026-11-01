'use client';

import { ConstructionIcon, ExternalLinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { useSaveSetting, useSettings } from '@/lib/queries/system';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maeyja.com').replace(/\/$/, '');

/**
 * One button in the top bar that closes the shop for maintenance (a "back soon" page, in every language) and opens
 * it again. While it is closed, the preview link shows the real shop to whoever opens it. Hidden for roles that
 * can't read the settings.
 */
export function MaintenanceToggle() {
  const settings = useSettings();
  const save = useSaveSetting();
  const confirm = useConfirm();
  const m = settings.data?.maintenance;
  if (!m) return null;

  const toggle = () =>
    confirm.ask({
      title: m.enabled ? 'Site yeniden açılsın mı?' : 'Site bakıma alınsın mı?',
      description: m.enabled
        ? 'Müşteriler mağazayı yeniden görür; bir iki saniye içinde açılır.'
        : 'Müşteriler bütün sayfalarda “kısa bir bakımdayız” sayfasını görür (11 dilde). Admin ve siparişler çalışmaya devam eder. Siteyi kendin görmek için “Önizle” bağlantısını kullan.',
      confirmLabel: m.enabled ? 'Siteyi aç' : 'Bakıma al',
      destructive: !m.enabled,
      onConfirm: () => save.mutateAsync({ key: 'maintenance', value: { ...m, enabled: !m.enabled } }),
    });

  return (
    <>
      {m.enabled && m.previewToken ? (
        <Button variant="ghost" size="sm" render={<a href={`${SITE_URL}/?preview=${m.previewToken}`} target="_blank" rel="noopener" />}>
          <ExternalLinkIcon /> <span className="hidden sm:inline">Önizle</span>
        </Button>
      ) : null}
      <Button
        variant={m.enabled ? 'destructive' : 'outline'}
        size="sm"
        disabled={save.isPending}
        onClick={toggle}
        title={m.enabled ? 'Site bakımda: tıklayınca açılır' : 'Siteyi bakıma al'}
      >
        <ConstructionIcon />
        <span className="hidden sm:inline">{m.enabled ? 'Bakımda · Siteyi aç' : 'Bakım modu'}</span>
      </Button>
      {confirm.dialog}
    </>
  );
}
