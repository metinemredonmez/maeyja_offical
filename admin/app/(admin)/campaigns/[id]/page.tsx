'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConicalIcon, SendIcon, SquareIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CampaignForm, MailDisabledNotice } from '@/components/marketing/campaign-form';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime, KeyValue, Section } from '@/components/shared/primitives';
import { QueryState } from '@/components/shared/query-state';
import { ToneBadge } from '@/components/shared/status-badge';
import { sanitize } from '@/lib/html';
import { LOCALE_LABELS, type Locale } from '@/lib/i18n';
import { CAMPAIGN_AUDIENCE, CAMPAIGN_STATUS } from '@/lib/labels';
import { useMe } from '@/lib/queries/auth';
import {
  useCampaign,
  useCampaignAudience,
  useCancelCampaign,
  useDeleteCampaign,
  useSendCampaign,
  useTestCampaign,
  useUpdateCampaign,
} from '@/lib/queries/marketing';
import type { EmailCampaignDetail } from '@/lib/types';

/** Test + send panel shown next to a draft. Buttons are type="button" because they sit inside the draft form. */
function SendPanel({ c }: { c: EmailCampaignDetail }) {
  const me = useMe();
  const [to, setTo] = useState('');
  const test = useTestCampaign();
  const send = useSendCampaign();
  const del = useDeleteCampaign();
  const confirm = useConfirm();
  const router = useRouter();
  const audience = useCampaignAudience({ audience: c.audience, locale: c.locale });
  const count = audience.data?.count ?? 0;

  return (
    <Section title="Gönder" description="Gönderim kayıtlı taslağı kullanır — değişiklik yaptıysanız önce kaydedin.">
      <div className="grid gap-3">
        <div className="flex gap-2">
          <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder={me.data?.email ?? 'test@ornek.com'} aria-label="Test e-posta adresi" />
          <Button type="button" variant="outline" disabled={!c.mailEnabled || test.isPending} onClick={() => test.mutate({ id: c.id, email: to.trim() || undefined })}>
            <FlaskConicalIcon /> Test
          </Button>
        </div>
        <Button
          type="button"
          disabled={!c.mailEnabled || count === 0 || send.isPending}
          onClick={() =>
            confirm.ask({
              title: `${count} kişiye gönderilsin mi?`,
              description: 'Gönderim arka planda dakikada yaklaşık 100 e-posta hızıyla ilerler. Başladıktan sonra içerik değiştirilemez; gerekirse durdurabilirsiniz.',
              confirmLabel: 'Gönder',
              onConfirm: () => send.mutateAsync(c.id),
            })
          }
        >
          <SendIcon /> Şimdi gönder
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground hover:text-[#A3121B]"
          onClick={() =>
            confirm.ask({
              title: 'Taslak silinsin mi?',
              confirmLabel: 'Sil',
              destructive: true,
              onConfirm: async () => {
                await del.mutateAsync(c.id);
                router.replace('/campaigns');
              },
            })
          }
        >
          <Trash2Icon /> Taslağı sil
        </Button>
      </div>
      {confirm.dialog}
    </Section>
  );
}

/** Progress, result and a read-only copy of what was sent. */
function CampaignReport({ c }: { c: EmailCampaignDetail }) {
  const cancel = useCancelCampaign();
  const del = useDeleteCampaign();
  const confirm = useConfirm();
  const router = useRouter();
  const done = c.sentCount + c.failedCount;
  const pct = c.totalRecipients ? Math.round((done / c.totalRecipients) * 100) : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Section title="İçerik">
        <div className="space-y-3">
          {c.preheader && <p className="text-xs text-muted-foreground">Önizleme: {c.preheader}</p>}
          {c.title && <h2 className="text-lg font-medium">{c.title}</h2>}
          <div className="prose prose-sm prose-neutral max-w-none" dangerouslySetInnerHTML={{ __html: sanitize(c.body) }} />
          {c.ctaLabel && c.ctaUrl && (
            <p className="text-sm">
              Buton: <b>{c.ctaLabel}</b> → <span className="font-mono text-xs">{c.ctaUrl}</span>
            </p>
          )}
        </div>
      </Section>

      <div className="space-y-5">
        <Section
          title="Gönderim"
          actions={
            c.status === 'SENDING' ? (
              <Button size="sm" variant="outline" onClick={() => confirm.ask({ title: 'Gönderim durdurulsun mu?', description: 'Henüz gönderilmemiş kişilere gitmez.', confirmLabel: 'Durdur', destructive: true, onConfirm: () => cancel.mutateAsync(c.id) })}>
                <SquareIcon /> Durdur
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-[#A3121B]"
                aria-label="Sil"
                onClick={() =>
                  confirm.ask({
                    title: 'Kampanya kaydı silinsin mi?',
                    description: 'Gönderilmiş e-postalar geri alınmaz; yalnızca bu kayıt ve alıcı listesi silinir.',
                    confirmLabel: 'Sil',
                    destructive: true,
                    onConfirm: async () => {
                      await del.mutateAsync(c.id);
                      router.replace('/campaigns');
                    },
                  })
                }
              >
                <Trash2Icon />
              </Button>
            )
          }
        >
          <div className="grid gap-3 text-sm">
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>
                  {done} / {c.totalRecipients}
                </span>
                <span>%{pct}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <KeyValue label="Gönderilen">{c.sentCount}</KeyValue>
            <KeyValue label="Hata">{c.failedCount}</KeyValue>
            {c.status === 'SENDING' && <KeyValue label="Bekleyen">{c.pendingCount}</KeyValue>}
            <KeyValue label="Hedef">
              {CAMPAIGN_AUDIENCE[c.audience]} · {c.locale ? LOCALE_LABELS[c.locale as Locale] ?? c.locale : 'Tüm diller'}
            </KeyValue>
            <KeyValue label="Başladı">
              <DateTime value={c.startedAt} />
            </KeyValue>
            {c.finishedAt && (
              <KeyValue label="Bitti">
                <DateTime value={c.finishedAt} />
              </KeyValue>
            )}
          </div>
        </Section>
        {c.failures.length > 0 && (
          <Section title="Gönderilemeyenler" description="İlk 20 kayıt">
            <ul className="space-y-2 text-xs">
              {c.failures.map((f) => (
                <li key={f.email}>
                  <p className="font-mono">{f.email}</p>
                  <p className="text-muted-foreground">{f.error}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
      {confirm.dialog}
    </div>
  );
}

export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useCampaign(id);
  const save = useUpdateCampaign();
  return (
    <QueryState query={query}>
      {(c) => (
        <>
          <PageHeader
            title={
              <span className="flex items-center gap-2">
                {c.subject} <ToneBadge tone={CAMPAIGN_STATUS[c.status].tone}>{CAMPAIGN_STATUS[c.status].label}</ToneBadge>
              </span>
            }
            backHref="/campaigns"
            backLabel="Kampanyalar"
          />
          {!c.mailEnabled && c.status === 'DRAFT' && <MailDisabledNotice />}
          {c.status === 'DRAFT' ? (
            <CampaignForm key={c.updatedAt} campaign={c} onSubmit={(body) => save.mutateAsync({ id: c.id, body })} submitting={save.isPending} error={save.error} aside={<SendPanel c={c} />} />
          ) : (
            <CampaignReport c={c} />
          )}
        </>
      )}
    </QueryState>
  );
}
