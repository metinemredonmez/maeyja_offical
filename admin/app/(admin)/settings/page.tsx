'use client';

import { useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Field, SubmitButton, SwitchField } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime, Section } from '@/components/shared/primitives';
import { QueryState } from '@/components/shared/query-state';
import { useConnectStripe, useDisconnectStripe, useSaveSetting, useSettings, useStripeStatus } from '@/lib/queries/system';
import { cn } from '@/lib/utils';
import type { Carrier, SettingKey, Settings } from '@/lib/types';

/** Maintenance has no tab: it is the one-click button in the top bar. */
const TAB_LABELS: Record<Exclude<SettingKey, 'maintenance' | 'aiStudio' | 'cartReminder'> | 'stripe', string> = { store: 'Mağaza', shipping: 'Kargo', tax: 'KDV', checkout: 'Ödeme adımı', stripe: 'Kartla ödeme', bankTransfer: 'Havale / EFT', assistant: 'Asistan', tryon: 'Sanal deneme', productPage: 'Ürün sayfası rengi', tracking: 'İzleme ve görünürlük' };

/** Generic per-key editor state: a local draft of the setting value and a save button. Tabs are re-keyed by value, so no sync effect. */
function useDraft<K extends SettingKey>(key: K, initial: Settings[K]) {
  const [draft, setDraft] = useState<Settings[K]>(initial);
  const save = useSaveSetting();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  return { draft, setDraft, dirty, save: () => save.mutate({ key, value: draft }), saving: save.isPending };
}

function SaveBar({ dirty, saving, onSave, onReset, blocked = false }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void; blocked?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t pt-4">
      {dirty && (
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Vazgeç
        </Button>
      )}
      <SubmitButton type="button" loading={saving} disabled={!dirty || blocked} onClick={onSave}>
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

const STRIPE_KEY = /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/;

/** The only Stripe step left to staff: paste the secret key. The API checks it and sets up the webhook. */
function StripeTab() {
  const query = useStripeStatus();
  const connect = useConnectStripe();
  const disconnect = useDisconnectStripe();
  const [key, setKey] = useState('');
  const [confirming, setConfirming] = useState(false);
  const valid = STRIPE_KEY.test(key.trim());
  return (
    <Section
      title="Kartla ödeme (Stripe)"
      description="Stripe panelinde Developers → API keys bölümündeki gizli anahtarı (sk_live_…) yapıştırıp kaydedin. Anahtar Stripe'a sorularak doğrulanır, webhook kendiliğinden kurulur."
    >
      <QueryState query={query}>
        {(st) => (
          <div className="grid gap-4 sm:max-w-lg">
            <div className="rounded-lg border p-3 text-sm">
              {st.configured ? (
                <>
                  <p className="font-medium">
                    Bağlı · {st.mode === 'live' ? 'Canlı mod' : 'Test modu'} · <span className="font-mono">{st.keyHint}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {st.webhook ? 'Webhook kurulu.' : 'Webhook yok: ödemeler yalnız müşteri siteye dönünce işlenir.'}
                    {st.source === 'env' ? ' Anahtar sunucu ayarından (.env) geliyor.' : st.savedAt ? <> Kaydedildi: <DateTime value={st.savedAt} /></> : null}
                  </p>
                  {st.mode === 'test' && <p className="mt-2 text-xs text-amber-700">Test modunda gerçek para çekilmez. Siteyi açmadan önce canlı anahtarı girin.</p>}
                </>
              ) : (
                <p className="text-muted-foreground">Bağlı değil: mağazada kartla ödeme kapalı.</p>
              )}
            </div>
            <Field label={st.configured ? 'Yeni gizli anahtar' : 'Gizli anahtar'} htmlFor="stripe-key" error={key && !valid ? { message: 'sk_live_… ya da rk_live_… ile başlamalı' } : undefined}>
              <Input id="stripe-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk_live_…" className="font-mono" />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              {st.source === 'admin' && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                  Bağlantıyı kaldır
                </Button>
              )}
              <SubmitButton type="button" loading={connect.isPending} disabled={!valid} onClick={() => connect.mutate(key.trim(), { onSuccess: () => setKey('') })}>
                Kaydet ve bağla
              </SubmitButton>
            </div>
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title="Stripe bağlantısı kaldırılsın mı?"
              description="Kayıtlı anahtar silinir ve webhook kaldırılır. Sunucuda .env anahtarı yoksa mağazada kartla ödeme kapanır."
              confirmLabel="Kaldır"
              destructive
              loading={disconnect.isPending}
              onConfirm={() => disconnect.mutateAsync().then(() => setConfirming(false))}
            />
          </div>
        )}
      </QueryState>
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

function AssistantTab({ value }: { value: Settings['assistant'] }) {
  const d = useDraft('assistant', value);
  const set = (patch: Partial<Settings['assistant']>) => d.setDraft({ ...d.draft, ...patch });
  return (
    <Section
      title="Sohbet asistanı"
      description="Sitenin sağ altındaki asistan (Claude). Ürünleri, fiyat ve stokları, SSS'yi, kargo-iade, bakım ve Uzmanlık sayfalarını kendisi okur; ziyaretçinin dilinde cevap verir. Sohbetler saklanmaz."
    >
      <div className="grid gap-4">
        <SwitchField label="Asistan açık" description="Kapalıyken sitede görünmez." checked={d.draft.enabled} onCheckedChange={(v) => set({ enabled: v })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Karşılama mesajı (TR)" htmlFor="as-welcome-tr">
            <Textarea id="as-welcome-tr" rows={3} value={d.draft.welcome?.tr ?? ''} onChange={(e) => set({ welcome: { ...d.draft.welcome, tr: e.target.value } })} />
          </Field>
          <Field label="Karşılama mesajı (EN — diğer diller de bunu görür)" htmlFor="as-welcome-en">
            <Textarea id="as-welcome-en" rows={3} value={d.draft.welcome?.en ?? ''} onChange={(e) => set({ welcome: { ...d.draft.welcome, en: e.target.value } })} />
          </Field>
        </div>
        <Field
          label="Kurallar ve ek bilgiler"
          htmlFor="as-instructions"
          hint="Ör. “Kişiye özel üretim sorulursa hello@maeyja.com'a yönlendir.” · “Kasım sonuna kadar Beymen İstinye'de pop-up var.” Fiyat, stok ve sayfalar zaten otomatik okunur."
        >
          <Textarea id="as-instructions" rows={6} maxLength={4000} value={d.draft.instructions ?? ''} onChange={(e) => set({ instructions: e.target.value })} />
        </Field>
        <Field
          label="Acil durumda WhatsApp numarası"
          htmlFor="as-whatsapp"
          hint="Siparişte sorun, hasarlı ürün, şikâyet ya da ziyaretçi bir kişiyle görüşmek isterse asistan bu numaraya WhatsApp butonu çıkarır; ziyaretçinin derdi mesaja hazır yazılır. Ülke koduyla: +33 6 12 34 56 78. Boşsa e-postaya yönlendirir."
        >
          <Input id="as-whatsapp" inputMode="tel" placeholder="+33 6 …" className="max-w-xs" value={d.draft.handoffWhatsapp ?? ''} onChange={(e) => set({ handoffWhatsapp: e.target.value })} />
        </Field>
      </div>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={d.save} onReset={() => d.setDraft(value)} />
    </Section>
  );
}

function TryOnTab({ value }: { value: Settings['tryon'] }) {
  const d = useDraft('tryon', value);
  return (
    <Section
      title="Üzerimde gör (sanal deneme)"
      description="Ürün sayfasında ziyaretçi kendi fotoğrafını yükler, yapay zekâ (Google Gemini) seçili çantayı onun üzerinde gösterir. Ziyaretçi önce açık rıza ve 18 yaş beyanı verir; fotoğraf saklanmaz, sonuç 10 dakika sonra silinir. Görsel başına ücretlidir: ziyaretçi başına saatte 3 / günde 8, mağaza geneli günde 100 deneme sınırı vardır."
    >
      <SwitchField label="Sanal deneme açık" description="Gemini anahtarı sunucuda tanımlı; başka bir şey gerekmez. Açıp kaydedince ürün sayfalarında “Üzerimde gör” butonu en geç 5 dakikada çıkar." checked={d.draft.enabled} onCheckedChange={(v) => d.setDraft({ ...d.draft, enabled: v })} />
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={d.save} onReset={() => d.setDraft(value)} />
    </Section>
  );
}

const PRODUCT_PAGE_PRESETS: { label: string; ground: string; tile: string }[] = [
  { label: 'Krem (şimdiki)', ground: '#f5f1ea', tile: '#e9e3d8' },
  { label: 'Beyaz – BOYY gibi', ground: '#ffffff', tile: '#f2f2f2' },
];
const HEX = /^#[0-9a-f]{6}$/i;

/** Page ground and photo tile of the product pages; the rest of the site keeps its cream. */
function ProductPageTab({ value }: { value: Settings['productPage'] }) {
  const d = useDraft('productPage', value);
  const set = (k: 'ground' | 'tile', v: string) => d.setDraft({ ...d.draft, [k]: v });
  const valid = HEX.test(d.draft.ground) && HEX.test(d.draft.tile);
  const color = (k: 'ground' | 'tile', label: string, hint: string) => (
    <Field label={label} hint={hint} htmlFor={`pp-${k}`}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={label} value={HEX.test(d.draft[k]) ? d.draft[k] : '#000000'} onChange={(e) => set(k, e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1" />
        <Input id={`pp-${k}`} value={d.draft[k]} onChange={(e) => set(k, e.target.value.trim())} maxLength={7} className="w-32 font-mono" aria-invalid={!HEX.test(d.draft[k])} />
      </div>
    </Field>
  );
  return (
    <Section
      title="Ürün sayfası rengi"
      description="Yalnızca ürün sayfalarında geçerlidir; ana sayfa ve diğer sayfalar krem kalır. Çanta fotoğraflarının kendi zemini #F2F2F2 açık gridir: sayfa beyaz olunca BOYY'deki gibi beyaz üstünde gri kutular olarak görünür. Kaydedince sitede en geç bir dakikada değişir."
    >
      <div className="flex flex-wrap gap-2">
        {PRODUCT_PAGE_PRESETS.map((p) => (
          <Button key={p.label} type="button" size="sm" variant={d.draft.ground === p.ground && d.draft.tile === p.tile ? 'default' : 'outline'} onClick={() => d.setDraft({ ground: p.ground, tile: p.tile })}>
            <span className="size-3.5 rounded-sm border" style={{ background: p.ground }} />
            <span className="size-3.5 rounded-sm border" style={{ background: p.tile }} />
            {p.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {color('ground', 'Sayfa zemini', 'Ürün sayfasının arka planı, üst çubuk ve alt bilgi dahil.')}
        {color('tile', 'Fotoğraf zemini', 'Fotoğrafın arkasındaki kutu; fotoğraf yüklenirken ve kenarlarda görünür.')}
      </div>
      <div className="rounded-lg border p-6" style={{ background: HEX.test(d.draft.ground) ? d.draft.ground : undefined }} aria-hidden="true">
        <p className="mb-3 text-xs text-muted-foreground">Önizleme</p>
        <div className="flex items-end gap-6">
          <div className="flex aspect-[4/5] w-28 items-end justify-center pb-4" style={{ background: HEX.test(d.draft.tile) ? d.draft.tile : undefined }}>
            <div className="h-14 w-16 rounded-sm bg-[#B3261E]" />
          </div>
          <div className="space-y-1 text-sm">
            <p className="italic">Petal Box, Chili</p>
            <p className="text-muted-foreground">20.000 TL</p>
          </div>
        </div>
      </div>
      {!valid && <p className="text-xs text-destructive">Renk kodu # ile başlayan 6 haneli olmalı, ör. #ffffff.</p>}
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={d.save} onReset={() => d.setDraft(value)} blocked={!valid} />
    </Section>
  );
}

type TrackingKey = Exclude<keyof Settings['tracking'], 'allowAiCrawlers'>;

/** What each ID looks like; a wrong paste (an e-mail, a whole HTML tag, the admin password) is caught before saving. */
const TRACKING_FORMATS: Record<TrackingKey, [RegExp, string]> = {
  metaPixelId: [/^\d{10,20}$/, 'Pixel ID yalnızca rakamdır (genelde 15-16 hane).'],
  metaCapiToken: [/^EAA[\w-]{30,}$/, 'Token “EAA” ile başlayan uzun bir harf-rakam dizisidir.'],
  metaTestCode: [/^TEST\w+$/, '“TEST” ile başlar, ör. TEST12345.'],
  ga4Id: [/^G-[A-Z0-9]{4,}$/, '“G-” ile başlar, ör. G-AB12CD34EF.'],
  ga4ApiSecret: [/^[\w-]{16,}$/, 'Gizli anahtar 20 karakter kadar harf-rakam dizisidir.'],
  googleAdsId: [/^AW-\d{6,}$/, '“AW-” ile başlar, ör. AW-123456789.'],
  googleAdsPurchaseLabel: [/^[\w-]{6,}$/, 'Yalnızca etiket: eğik çizgiden sonraki harf-rakam dizisi.'],
  googleSiteVerification: [/^[\w-]{20,}$/, 'Yalnızca content="…" içindeki kod (tırnaksız).'],
};

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-2 hover:text-[#A3121B]">
      {children}
    </a>
  );
}

function TrackingTab({ value }: { value: Settings['tracking'] }) {
  const d = useDraft('tracking', value);
  const set = (patch: Partial<Settings['tracking']>) => d.setDraft({ ...d.draft, ...patch });
  const invalid = (key: TrackingKey) => {
    const v = String(d.draft[key] ?? '');
    return v !== '' && !TRACKING_FORMATS[key][0].test(v);
  };
  const anyInvalid = (Object.keys(TRACKING_FORMATS) as TrackingKey[]).some(invalid);
  // Whole snippets are pasted as often as bare IDs: keep only the part each field needs.
  const clean = (key: TrackingKey, raw: string): Partial<Settings['tracking']> => {
    const v = raw.trim();
    if (key === 'googleSiteVerification') return { [key]: v.match(/content=["']([^"']+)["']/)?.[1] ?? v };
    if (key === 'googleAdsId' || key === 'googleAdsPurchaseLabel') {
      const sendTo = v.match(/(AW-\d+)\/([\w-]+)/);
      if (sendTo) return { googleAdsId: sendTo[1], googleAdsPurchaseLabel: sendTo[2] };
    }
    if (key === 'ga4Id') return { [key]: v.toUpperCase() };
    return { [key]: v };
  };
  // Secrets are masked with CSS, not type="password": a password field makes the browser fill in the admin's saved
  // e-mail and password here (and offer to save the token as a password).
  const text = (key: TrackingKey, label: string, hint: React.ReactNode, placeholder = '', secret = false) => (
    <Field label={label} htmlFor={`tr-${key}`} hint={hint} error={invalid(key) ? TRACKING_FORMATS[key][1] : undefined}>
      <Input
        id={`tr-${key}`}
        name={`mj-${key}`}
        autoComplete="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        className={cn('font-mono text-xs', secret && '[-webkit-text-security:disc]')}
        placeholder={placeholder}
        value={String(d.draft[key] ?? '')}
        onChange={(e) => set(clean(key, e.target.value))}
      />
    </Field>
  );
  const events = <Ext href="https://business.facebook.com/events_manager2">Meta Events Manager</Ext>;
  const ga = <Ext href="https://analytics.google.com/analytics/web/#/a/admin">Google Analytics → Yönetici</Ext>;
  return (
    <>
      <Section
        title="Reklam pikselleri"
        description="Ziyaretler, ürün görüntüleme, sepete ekleme, ödemeye geçiş ve satın alma Meta ve Google'a gider. Sitede çerez onayı çıkar; pikseller yalnızca ziyaretçi kabul ederse yüklenir. Satın alma ayrıca sunucudan da gönderilir (iki taraflı), sipariş numarasıyla eşleştirildiği için iki kez sayılmaz."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {text('metaPixelId', 'Meta Pixel ID', <>{events} → solda Veri kaynakları → pikseli seçin → Ayarlar sekmesi → “Veri kümesi kimliği / Pixel ID” (yalnızca rakam).</>, '1234567890123456')}
          {text('metaCapiToken', 'Meta Conversions API erişim tokenı', <>{events} → aynı pikselin Ayarlar sekmesi → “Dönüşüm API’si” → “Erişim tokenı oluştur”. Sunucuda kalır, sitede görünmez.</>, 'EAA…', true)}
          {text('metaTestCode', 'Meta test olayı kodu (opsiyonel)', <>{events} → pikseli seçin → “Olayları test et” sekmesi → Sunucu olayları altındaki TEST… kodu. Denemeden sonra boşaltın.</>, 'TEST12345')}
          {text('ga4Id', 'Google Analytics 4 ölçüm kimliği', <>{ga} → Veri toplama → Veri akışları → web akışını seçin → “Ölçüm kimliği” (G-…).</>, 'G-XXXXXXXXXX')}
          {text('ga4ApiSecret', 'GA4 Measurement Protocol API gizli anahtarı', <>{ga} → aynı web akışı → “Measurement Protocol API gizli anahtarları” → Oluştur → “Gizli anahtar değeri”. Sunucuda kalır.</>, '', true)}
          {text('googleAdsId', 'Google Ads dönüşüm kimliği (opsiyonel)', <><Ext href="https://ads.google.com/aw/conversions">Google Ads → Hedefler → Dönüşümler</Ext> → satın alma dönüşümü → Etiket ayarları → “Etiketi kendiniz yükleyin”. send_to: &apos;AW-…/…&apos; satırını bütün olarak buraya yapıştırabilirsiniz, ikiye bölünür.</>, 'AW-123456789')}
          {text('googleAdsPurchaseLabel', 'Google Ads satın alma etiketi (opsiyonel)', 'Aynı send_to değerinde eğik çizgiden sonraki kısım (yukarıya bütün olarak yapıştırırsanız kendiliğinden dolar).', 'AbCdEfGhIj')}
        </div>
      </Section>
      <Section
        title="Google ve AI ajanlarında görünürlük"
        description="ChatGPT, Claude, Perplexity, Gemini gibi yapay zekâ asistanları ve Google, mağazayı ve çantaları doğru okuyabilsin diye."
      >
        <div className="grid gap-4">
          {text(
            'googleSiteVerification',
            'Google Search Console doğrulama kodu',
            <>
              <Ext href="https://search.google.com/search-console/welcome">Search Console</Ext> → “URL ön eki” kutusuna https://maeyja.com → Doğrulama yöntemleri → HTML etiketi → gösterilen etiketi bütün olarak buraya yapıştırın (kod kendiliğinden ayrılır), kaydedin, 5 dk sonra Search Console’da “Doğrula”.
            </>,
            'abc123…',
          )}
          <SwitchField
            label="AI ajanları siteyi okuyabilsin"
            description="Kapalıysa ChatGPT, Claude, Perplexity, Gemini gibi asistanların tarayıcıları robots.txt ile engellenir ve llms.txt kapanır."
            checked={d.draft.allowAiCrawlers}
            onCheckedChange={(v) => set({ allowAiCrawlers: v })}
          />
          <div className="space-y-1.5 rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">
            <p className="font-medium">Hazır adresler — nereye ne yapıştırılır</p>
            <p>
              <Ext href="https://merchants.google.com/">Google Merchant Center</Ext> → Ürünler → Veri kaynakları → Ürün kaynağı ekle → “Dosya ekle” → URL ile planlanmış getirme:{' '}
              <code>https://maeyja.com/feeds/products.xml</code> (İngilizce mağaza için sonuna <code>?lang=en</code>).
            </p>
            <p>
              <Ext href="https://business.facebook.com/commerce">Meta Commerce Manager</Ext> → Katalog → Veri kaynakları → Veri kaynağı ekle → Veri akışı → planlanmış akış, aynı adres.
            </p>
            <p>
              Search Console → Site haritaları: <code>https://maeyja.com/sitemap.xml</code> · AI ajanları için özet: <code>https://maeyja.com/llms.txt</code>
            </p>
          </div>
        </div>
        <SaveBar dirty={d.dirty} blocked={anyInvalid} saving={d.saving} onSave={d.save} onReset={() => d.setDraft(value)} />
      </Section>
    </>
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
              {(Object.keys(TAB_LABELS) as (keyof typeof TAB_LABELS)[]).map((k) => (
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
            <TabsContent value="stripe">
              <StripeTab />
            </TabsContent>
            <TabsContent value="bankTransfer">
              <BankTransferTab key={JSON.stringify(s.bankTransfer)} value={s.bankTransfer} />
            </TabsContent>
            <TabsContent value="assistant">
              <AssistantTab key={JSON.stringify(s.assistant)} value={s.assistant} />
            </TabsContent>
            <TabsContent value="tryon">
              <TryOnTab key={JSON.stringify(s.tryon)} value={s.tryon} />
            </TabsContent>
            <TabsContent value="productPage">
              <ProductPageTab key={JSON.stringify(s.productPage)} value={s.productPage} />
            </TabsContent>
            <TabsContent value="tracking">
              <TrackingTab key={JSON.stringify(s.tracking)} value={s.tracking} />
            </TabsContent>
          </Tabs>
        )}
      </QueryState>
    </>
  );
}
