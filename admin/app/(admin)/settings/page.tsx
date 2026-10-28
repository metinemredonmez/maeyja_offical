'use client';

import { useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Field, SubmitButton, SwitchField } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { Section } from '@/components/shared/primitives';
import { QueryState } from '@/components/shared/query-state';
import { useSaveSetting, useSettings } from '@/lib/queries/system';
import type { Carrier, SettingKey, Settings } from '@/lib/types';

const TAB_LABELS: Record<SettingKey, string> = { store: 'Mağaza', shipping: 'Kargo', tax: 'KDV', checkout: 'Ödeme adımı', bankTransfer: 'Havale / EFT' };

/** Generic per-key editor state: a local draft of the setting value and a save button. Tabs are re-keyed by value, so no sync effect. */
function useDraft<K extends SettingKey>(key: K, initial: Settings[K]) {
  const [draft, setDraft] = useState<Settings[K]>(initial);
  const save = useSaveSetting();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  return { draft, setDraft, dirty, save: () => save.mutate({ key, value: draft }), saving: save.isPending };
}

function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t pt-4">
      {dirty && (
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Vazgeç
        </Button>
      )}
      <SubmitButton type="button" loading={saving} disabled={!dirty} onClick={onSave}>
        Kaydet
      </SubmitButton>
    </div>
  );
}

function StoreTab({ value }: { value: Settings['store'] }) {
  const d = useDraft('store', value);
  const set = (patch: Partial<Settings['store']>) => d.setDraft({ ...d.draft, ...patch });
  return (
    <Section title="Mağaza bilgileri" description="Site altbilgisi, e-posta şablonları ve iletişim sayfasında kullanılır.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marka adı" htmlFor="store-name">
          <Input id="store-name" value={d.draft.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Slogan" htmlFor="store-tagline">
          <Input id="store-tagline" value={d.draft.tagline} onChange={(e) => set({ tagline: e.target.value })} />
        </Field>
        <Field label="E-posta" htmlFor="store-email">
          <Input id="store-email" type="email" value={d.draft.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="Telefon" htmlFor="store-phone">
          <Input id="store-phone" value={d.draft.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Adres" htmlFor="store-address" className="sm:col-span-2">
          <Input id="store-address" value={d.draft.address} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field label="Instagram" htmlFor="store-ig" className="sm:col-span-2">
          <Input id="store-ig" value={d.draft.instagram} onChange={(e) => set({ instagram: e.target.value })} />
        </Field>
        <Field label="Duyuru şeridi (TR)" htmlFor="ann-tr" hint="Boşsa şerit gizlenir">
          <Input id="ann-tr" value={d.draft.announcement?.tr ?? ''} onChange={(e) => set({ announcement: { ...d.draft.announcement, tr: e.target.value } })} />
        </Field>
        <Field label="Duyuru şeridi (EN)" htmlFor="ann-en">
          <Input id="ann-en" value={d.draft.announcement?.en ?? ''} onChange={(e) => set({ announcement: { ...d.draft.announcement, en: e.target.value } })} />
        </Field>
      </div>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={d.save} onReset={() => d.setDraft(value)} />
    </Section>
  );
}

function ShippingTab({ value }: { value: Settings['shipping'] }) {
  const d = useDraft('shipping', value);
  const set = (patch: Partial<Settings['shipping']>) => d.setDraft({ ...d.draft, ...patch });
  const setCarrier = (i: number, patch: Partial<Carrier>) => set({ carriers: d.draft.carriers.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <Section title="Kargo" description="Ücretler KDV dahildir. Eşik 0 ise kargo her zaman ücretsizdir.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Sabit kargo ücreti (₺)" htmlFor="ship-flat">
          <Input id="ship-flat" type="number" min={0} step="0.01" value={d.draft.flatRate} onChange={(e) => set({ flatRate: Number(e.target.value) })} />
        </Field>
        <Field label="Ücretsiz kargo eşiği (₺)" htmlFor="ship-free">
          <Input id="ship-free" type="number" min={0} step="0.01" value={d.draft.freeShippingThreshold} onChange={(e) => set({ freeShippingThreshold: Number(e.target.value) })} />
        </Field>
        <Field label="Tahmini teslim (gün)" htmlFor="ship-days">
          <Input id="ship-days" value={d.draft.estimatedDays} onChange={(e) => set({ estimatedDays: e.target.value })} placeholder="1-3" />
        </Field>
      </div>
      <div className="mt-5">
        <p className="mb-2 text-xs font-medium">Kargo firmaları</p>
        <div className="space-y-2">
          <div className="hidden grid-cols-[110px_1fr_2fr_32px] gap-2 text-[11px] text-muted-foreground sm:grid">
            <span>Kod</span>
            <span>Ad</span>
            <span>Takip URL şablonu ({'{tracking}'} yerine takip no gelir)</span>
            <span />
          </div>
          {d.draft.carriers.map((c, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[110px_1fr_2fr_32px]">
              <Input value={c.code} onChange={(e) => setCarrier(i, { code: e.target.value })} placeholder="aras" className="font-mono text-xs" aria-label="Kod" />
              <Input value={c.name} onChange={(e) => setCarrier(i, { name: e.target.value })} placeholder="Aras Kargo" aria-label="Ad" />
              <Input value={c.trackingUrl} onChange={(e) => setCarrier(i, { trackingUrl: e.target.value })} placeholder="https://…?code={tracking}" className="font-mono text-xs" aria-label="Takip URL" />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => set({ carriers: d.draft.carriers.filter((_, j) => j !== i) })} aria-label="Kaldır" className="text-muted-foreground hover:text-[#A3121B]">
                <Trash2Icon />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set({ carriers: [...d.draft.carriers, { code: '', name: '', trackingUrl: '' }] })}>
            <PlusIcon /> Firma ekle
          </Button>
        </div>
      </div>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={d.save} onReset={() => d.setDraft(value)} />
    </Section>
  );
}

function TaxTab({ value }: { value: Settings['tax'] }) {
  const d = useDraft('tax', value);
  return (
    <Section title="KDV" description="Fiyatlar KDV dahildir; bu oran ürün bazında belirtilmemişse kullanılır. Deri ürünler %20, tekstil genelde %10.">
      <Field label="Varsayılan KDV oranı (%)" htmlFor="tax-rate" className="max-w-xs">
        <Input id="tax-rate" type="number" min={0} max={100} step={1} value={d.draft.defaultRate} onChange={(e) => d.setDraft({ defaultRate: Number(e.target.value) })} />
      </Field>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={d.save} onReset={() => d.setDraft(value)} />
    </Section>
  );
}

function CheckoutTab({ value }: { value: Settings['checkout'] }) {
  const d = useDraft('checkout', value);
  return (
    <Section title="Ödeme adımı">
      <div className="grid gap-4 sm:max-w-md">
        <SwitchField label="Misafir alışverişi" description="Kapalıysa sipariş için üye girişi zorunlu" checked={d.draft.guestCheckout} onCheckedChange={(v) => d.setDraft({ ...d.draft, guestCheckout: v })} />
        <Field label="Ürün başına en fazla adet" htmlFor="chk-max">
          <Input id="chk-max" type="number" min={1} step={1} value={d.draft.maxQtyPerItem} onChange={(e) => d.setDraft({ ...d.draft, maxQtyPerItem: Number(e.target.value) })} />
        </Field>
      </div>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={d.save} onReset={() => d.setDraft(value)} />
    </Section>
  );
}

function BankTransferTab({ value }: { value: Settings['bankTransfer'] }) {
  const d = useDraft('bankTransfer', value);
  const set = (patch: Partial<Settings['bankTransfer']>) => d.setDraft({ ...d.draft, ...patch });
  return (
    <Section title="Havale / EFT" description="Açıkken ödeme adımında havale seçeneği görünür; siparişi admin 'Ödendi' yapınca müşteriye onay gider.">
      <div className="grid gap-4 sm:grid-cols-2">
        <SwitchField label="Havale ile ödeme açık" checked={d.draft.enabled} onCheckedChange={(v) => set({ enabled: v })} className="sm:col-span-2" />
        <Field label="Banka" htmlFor="bt-bank">
          <Input id="bt-bank" value={d.draft.bankName} onChange={(e) => set({ bankName: e.target.value })} />
        </Field>
        <Field label="Hesap adı" htmlFor="bt-acc">
          <Input id="bt-acc" value={d.draft.accountName} onChange={(e) => set({ accountName: e.target.value })} />
        </Field>
        <Field label="IBAN" htmlFor="bt-iban" className="sm:col-span-2">
          <Input id="bt-iban" value={d.draft.iban} onChange={(e) => set({ iban: e.target.value.toUpperCase() })} className="font-mono" placeholder="TR00 0000 0000 0000 0000 0000 00" />
        </Field>
        <Field label="Açıklama (TR)" htmlFor="bt-note-tr">
          <Textarea id="bt-note-tr" rows={2} value={d.draft.note?.tr ?? ''} onChange={(e) => set({ note: { ...d.draft.note, tr: e.target.value } })} />
        </Field>
        <Field label="Açıklama (EN)" htmlFor="bt-note-en">
          <Textarea id="bt-note-en" rows={2} value={d.draft.note?.en ?? ''} onChange={(e) => set({ note: { ...d.draft.note, en: e.target.value } })} />
        </Field>
      </div>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={d.save} onReset={() => d.setDraft(value)} />
    </Section>
  );
}

export default function SettingsPage() {
  const query = useSettings();
  return (
    <>
      <PageHeader title="Ayarlar" description="Her sekme ayrı kaydedilir." />
      <QueryState query={query}>
        {(s) => (
          <Tabs defaultValue="store" className="gap-4">
            <TabsList>
              {(Object.keys(TAB_LABELS) as SettingKey[]).map((k) => (
                <TabsTrigger key={k} value={k}>
                  {TAB_LABELS[k]}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="store">
              <StoreTab key={JSON.stringify(s.store)} value={s.store} />
            </TabsContent>
            <TabsContent value="shipping">
              <ShippingTab key={JSON.stringify(s.shipping)} value={s.shipping} />
            </TabsContent>
            <TabsContent value="tax">
              <TaxTab key={JSON.stringify(s.tax)} value={s.tax} />
            </TabsContent>
            <TabsContent value="checkout">
              <CheckoutTab key={JSON.stringify(s.checkout)} value={s.checkout} />
            </TabsContent>
            <TabsContent value="bankTransfer">
              <BankTransferTab key={JSON.stringify(s.bankTransfer)} value={s.bankTransfer} />
            </TabsContent>
          </Tabs>
        )}
      </QueryState>
    </>
  );
}
