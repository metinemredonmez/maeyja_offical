'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SendIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Field, SwitchField } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { Section } from '@/components/shared/primitives';
import { QueryState } from '@/components/shared/query-state';
import { api } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import { useSaveSetting, useSettings } from '@/lib/queries/system';
import type { Settings } from '@/lib/types';

type FlowKey = 'mailWelcome' | 'mailAfterPurchase' | 'mailWinback';
type Flow = 'welcome' | 'afterPurchase' | 'winback';
type Stats = { smtp: boolean; flows: Record<Flow, { sent: number; failed: number }> };

const FLOWS: { key: FlowKey; flow: Flow; title: string; description: string }[] = [
  { key: 'mailWelcome', flow: 'welcome', title: 'Hoş geldin', description: 'Bültene yeni abone olan herkese bir kez, abone olduktan sonraki ilk saat içinde.' },
  { key: 'mailAfterPurchase', flow: 'afterPurchase', title: 'Sipariş sonrası', description: 'Sipariş kargoya verildikten birkaç gün sonra: bakım rehberi ve müşterinin düşüncesini sorma. Her siparişe bir kez.' },
  { key: 'mailWinback', flow: 'winback', title: 'Geri çağırma', description: 'Uzun süredir alışveriş yapmamış, e-posta izni veren müşterilere. Aynı kişiye bu süre içinde en çok bir kez.' },
];

const STATS_KEY = ['mail-automations', 'stats'] as const;

function FlowCard({ k, flow, title, description, value, stats }: { k: FlowKey; flow: Flow; title: string; description: string; value: Settings[FlowKey]; stats?: { sent: number; failed: number } }) {
  const [draft, setDraft] = useState(value);
  const save = useSaveSetting();
  const test = useApiMutation({ mutationFn: () => api.post(`/admin/mail-automations/test/${flow}`), success: 'Deneme e-postası adresinize gönderildi' });
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const set = (patch: Partial<Settings[FlowKey]>) => setDraft({ ...draft, ...patch } as Settings[FlowKey]);
  const text = (field: 'subject' | 'body', lang: 'tr' | 'en', v: string) => set({ [field]: { ...draft[field], [lang]: v } } as Partial<Settings[FlowKey]>);
  const after = k === 'mailAfterPurchase' ? (draft as Settings['mailAfterPurchase']) : null;
  const winback = k === 'mailWinback' ? (draft as Settings['mailWinback']) : null;

  return (
    <Section
      title={title}
      description={description}
      actions={stats ? <span className="text-xs text-muted-foreground">Son 30 gün: {stats.sent} gönderildi{stats.failed ? `, ${stats.failed} gönderilemedi` : ''}</span> : null}
    >
      <div className="grid gap-4">
        <SwitchField label="Açık" description="Açınca yalnız bundan sonraki aboneler/siparişler için çalışır; geriye dönük toplu gönderim yapmaz." checked={draft.enabled} onCheckedChange={(v) => set({ enabled: v })} />
        {after ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kargodan kaç gün sonra" htmlFor={`${k}-delay`}>
              <Input id={`${k}-delay`} type="number" min={1} max={90} className="w-28" value={after.delayDays} onChange={(e) => set({ delayDays: Number(e.target.value) } as Partial<Settings[FlowKey]>)} />
            </Field>
            <SwitchField
              label="Yalnız e-posta izni verenlere"
              description="Kapalıysa her alıcıya gider (yalnız bakım bilgisi içeriyorsa). Hukuki açıdan emin değilseniz açık bırakın."
              checked={after.onlyConsented}
              onCheckedChange={(v) => set({ onlyConsented: v } as Partial<Settings[FlowKey]>)}
            />
          </div>
        ) : null}
        {winback ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Son siparişten kaç gün sonra" htmlFor={`${k}-days`}>
              <Input id={`${k}-days`} type="number" min={30} max={730} className="w-28" value={winback.afterDays} onChange={(e) => set({ afterDays: Number(e.target.value) } as Partial<Settings[FlowKey]>)} />
            </Field>
            <Field label="Kupon kodu (opsiyonel)" htmlFor={`${k}-coupon`} hint="Kuponlar sayfasında tanımlı ve geçerli bir kod. Boşsa {coupon} geçen paragraf e-postada çıkmaz.">
              <Input id={`${k}-coupon`} className="w-48 font-mono uppercase" maxLength={40} value={winback.coupon} onChange={(e) => set({ coupon: e.target.value.trim() } as Partial<Settings[FlowKey]>)} />
            </Field>
          </div>
        ) : null}
        <Tabs defaultValue="tr" className="gap-3">
          <TabsList>
            <TabsTrigger value="tr">Türkçe</TabsTrigger>
            <TabsTrigger value="en">İngilizce (diğer diller de)</TabsTrigger>
          </TabsList>
          {(['tr', 'en'] as const).map((lang) => (
            <TabsContent key={lang} value={lang} className="grid gap-3">
              <Field label="Konu" htmlFor={`${k}-subject-${lang}`}>
                <Input id={`${k}-subject-${lang}`} maxLength={160} value={draft.subject?.[lang] ?? ''} onChange={(e) => text('subject', lang, e.target.value)} />
              </Field>
              <Field label="Metin" htmlFor={`${k}-body-${lang}`} hint="Paragrafları boş satırla ayırın. {name}: müşterinin adı (varsa) · {coupon}: kupon kodu.">
                <Textarea id={`${k}-body-${lang}`} rows={8} maxLength={4000} value={draft.body?.[lang] ?? ''} onChange={(e) => text('body', lang, e.target.value)} />
              </Field>
            </TabsContent>
          ))}
        </Tabs>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button type="button" variant="outline" size="sm" disabled={test.isPending || dirty} title={dirty ? 'Önce kaydedin' : undefined} onClick={() => test.mutate()}>
            <SendIcon /> Deneme gönder
          </Button>
          <div className="flex gap-2">
            {dirty ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(value)}>
                Geri al
              </Button>
            ) : null}
            <Button type="button" size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate({ key: k, value: draft })}>
              Kaydet
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

/** Pazarlama → Otomatik e-postalar: welcome, after purchase and win-back, each with its own switch and texts. */
export default function MailAutomationsPage() {
  const settings = useSettings();
  const stats = useQuery({ queryKey: STATS_KEY, queryFn: () => api.get<Stats>('/admin/mail-automations/stats') });
  return (
    <>
      <PageHeader
        title="Otomatik e-postalar"
        description="Kendiliğinden giden e-postalar. Yalnız e-posta izni olanlara gider, her birinde abonelikten çık bağlantısı vardır; abonelikten çıkana hiç gitmez. Sepet hatırlatma AI stüdyoda."
      />
      {stats.data && !stats.data.smtp ? (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          SMTP ayarlı değil: e-postalar şu an gönderilemiyor. Sunucuda SMTP ayarlanınca açık olan akışlar kendiliğinden çalışmaya başlar.
        </p>
      ) : null}
      <QueryState query={settings}>
        {(s) => (
          <div className="grid gap-5">
            {FLOWS.map((f) => (
              <FlowCard key={`${f.key}-${JSON.stringify(s[f.key])}`} k={f.key} flow={f.flow} title={f.title} description={f.description} value={s[f.key]} stats={stats.data?.flows[f.flow]} />
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}
