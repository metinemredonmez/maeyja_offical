'use client';

import { useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, LanguagesIcon, PlusIcon, RotateCcwIcon, SaveIcon, SparklesIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StorePreview } from '@/components/content/store-preview';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { QueryState } from '@/components/shared/query-state';
import { ToneBadge } from '@/components/shared/status-badge';
import { api, errorMessage } from '@/lib/api.client';
import { DEFAULT_LOCALE, LOCALE_LABELS, LOCALES } from '@/lib/i18n';
import { useNavigation, useResetNavigation, useSaveNavigation } from '@/lib/queries/content';
import type { NavFooterColumn, NavHeaderItem, NavKind, Navigation } from '@/lib/types';
import { cn } from '@/lib/utils';

const KIND: Record<NavKind, { label: string; hint: string }> = {
  link: { label: 'Bağlantı', hint: 'Bir sayfaya ya da https:// adresine gider' },
  bags: { label: 'Çantalar menüsü', hint: 'Modeller ve fotoğraflarla açılan menü' },
  expertise: { label: 'Uzmanlık menüsü', hint: 'Tasarım, malzeme, işçilik ve hikâye' },
  stores: { label: 'Mağazalar menüsü', hint: 'Satış noktaları ve iletişim' },
};

/** Turkish of the shop's own texts: used (and already translated into every language) while the name is left empty. */
const KEY_TR: Record<string, string> = {
  'nav.bags': 'Çantalar',
  'nav.expertise': 'Uzmanlık',
  'nav.journal': 'Dergi',
  'nav.stores': 'Mağazalar',
  'footer.shop': 'Mağaza',
  'footer.help': 'Yardım',
  'footer.legal': 'Yasal',
  'footer.clothing': 'Giyim — yakında',
  'footer.care': 'Deri bakım rehberi',
  'home.stockists': 'Satış noktaları',
  'footer.about': 'Hakkımızda',
  'footer.shippingReturns': 'Kargo ve iade',
  'footer.orderStatus': 'Sipariş takibi',
  'footer.faq': 'SSS',
  'footer.contact': 'İletişim',
  'footer.distance': 'Mesafeli satış sözleşmesi',
  'footer.preliminary': 'Ön bilgilendirme formu',
  'footer.kvkk': 'KVKK',
  'footer.privacy': 'Gizlilik ve çerezler',
  'consent.settings': 'Çerez tercihleri',
  'footer.terms': 'Kullanım koşulları',
};
const KIND_KEY: Record<Exclude<NavKind, 'link'>, string> = { bags: 'nav.bags', expertise: 'nav.expertise', stores: 'nav.stores' };
const OTHER = LOCALES.filter((l) => l !== DEFAULT_LOCALE);
const newId = () => crypto.randomUUID().slice(0, 8);
const move = <T,>(list: T[], i: number, by: -1 | 1) => (i + by < 0 || i + by >= list.length ? list : arrayMove(list, i, i + by));
const select = 'h-8 rounded-md border bg-background px-1.5 text-xs';

/** The Turkish name, and (behind the languages button) every other language; empty ones use the shop's own text. */
function Names({ value, textKey, open, onChange }: { value: Record<string, string>; textKey: string; open: boolean; onChange: (v: Record<string, string>) => void }) {
  if (!open) return null;
  return (
    <div className="mt-2 grid gap-2 rounded-lg bg-muted/40 p-2 sm:grid-cols-2">
      {OTHER.map((l) => (
        <label key={l} className="grid gap-1 text-xs text-muted-foreground">
          {LOCALE_LABELS[l]}
          <Input
            value={value[l] ?? ''}
            onChange={(e) => onChange({ ...value, [l]: e.target.value })}
            placeholder={textKey ? 'boş: hazır çeviri' : 'boş: Türkçe ad'}
            maxLength={80}
            className="h-8 text-sm text-foreground"
          />
        </label>
      ))}
    </div>
  );
}

function IconButton({ label, onClick, children, className, disabled }: { label: string; onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={onClick} aria-label={label} title={label} className={className} disabled={disabled}>
      {children}
    </Button>
  );
}

function HeaderRow({ item, onChange, onDelete }: { item: NavHeaderItem; onChange: (i: NavHeaderItem) => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [langs, setLangs] = useState(false);
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('rounded-xl border bg-card p-3', isDragging && 'z-10 shadow-lg', !item.visible && 'opacity-60')}>
      <div className="flex items-center gap-2">
        <button type="button" {...attributes} {...listeners} className="cursor-grab rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing" aria-label="Sürükle">
          <GripVerticalIcon className="size-4" />
        </button>
        <ToneBadge tone="neutral">{KIND[item.kind].label}</ToneBadge>
        <Input
          value={item.label.tr ?? ''}
          onChange={(e) => onChange({ ...item, label: { ...item.label, tr: e.target.value } })}
          placeholder={KEY_TR[item.key] ?? 'Ad'}
          maxLength={80}
          aria-label="Ad"
          className="h-8 min-w-0 flex-1"
        />
        <select value={item.side} onChange={(e) => onChange({ ...item, side: e.target.value as NavHeaderItem['side'] })} aria-label="Yer" className={select}>
          <option value="left">Solda</option>
          <option value="right">Sağda</option>
        </select>
        <Switch checked={item.visible} onCheckedChange={(v) => onChange({ ...item, visible: v })} aria-label="Görünsün" />
        <IconButton label="Diller" onClick={() => setLangs((o) => !o)} className={cn(langs && 'bg-muted')}>
          <LanguagesIcon />
        </IconButton>
        <IconButton label="Sil" onClick={onDelete} className="text-muted-foreground hover:text-[#A3121B]">
          <Trash2Icon />
        </IconButton>
      </div>
      {item.kind === 'link' ? (
        <Input value={item.href} onChange={(e) => onChange({ ...item, href: e.target.value })} placeholder="/journal ya da https://…" aria-label="Bağlantı" className="mt-2 h-8" />
      ) : null}
      <Names value={item.label} textKey={item.key} open={langs} onChange={(label) => onChange({ ...item, label })} />
    </li>
  );
}

function FooterColumnCard({
  column,
  first,
  last,
  onChange,
  onMove,
  onDelete,
}: {
  column: NavFooterColumn;
  first: boolean;
  last: boolean;
  onChange: (c: NavFooterColumn) => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [langs, setLangs] = useState<number | 'title' | null>(null);
  const setLink = (j: number, patch: Partial<NavFooterColumn['links'][number]>) => onChange({ ...column, links: column.links.map((l, k) => (k === j ? { ...l, ...patch } : l)) });
  return (
    <li className={cn('rounded-xl border bg-card p-3', !column.visible && 'opacity-60')}>
      <div className="flex items-center gap-2">
        <Input
          value={column.title.tr ?? ''}
          onChange={(e) => onChange({ ...column, title: { ...column.title, tr: e.target.value } })}
          placeholder={KEY_TR[column.key] ?? 'Sütun başlığı'}
          maxLength={80}
          aria-label="Sütun başlığı"
          className="h-8 min-w-0 flex-1 font-medium"
        />
        <Switch checked={column.visible} onCheckedChange={(v) => onChange({ ...column, visible: v })} aria-label="Görünsün" />
        <IconButton label="Diller" onClick={() => setLangs((o) => (o === 'title' ? null : 'title'))} className={cn(langs === 'title' && 'bg-muted')}>
          <LanguagesIcon />
        </IconButton>
        <IconButton label="Yukarı" onClick={() => onMove(-1)} disabled={first}>
          <ArrowUpIcon />
        </IconButton>
        <IconButton label="Aşağı" onClick={() => onMove(1)} disabled={last}>
          <ArrowDownIcon />
        </IconButton>
        <IconButton label="Sütunu sil" onClick={onDelete} className="text-muted-foreground hover:text-[#A3121B]">
          <Trash2Icon />
        </IconButton>
      </div>
      <Names value={column.title} textKey={column.key} open={langs === 'title'} onChange={(title) => onChange({ ...column, title })} />
      <ul className="mt-3 space-y-2 border-l pl-3">
        {column.links.map((l, j) => (
          <li key={j}>
            <div className="flex items-center gap-1.5">
              <Input value={l.label.tr ?? ''} onChange={(e) => setLink(j, { label: { ...l.label, tr: e.target.value } })} placeholder={KEY_TR[l.key] ?? 'Ad'} maxLength={80} aria-label="Ad" className="h-8 min-w-0 flex-1" />
              <Input value={l.href} onChange={(e) => setLink(j, { href: e.target.value })} placeholder="boş: düz yazı" aria-label="Bağlantı" className="h-8 min-w-0 flex-1 text-xs" />
              <IconButton label="Diller" onClick={() => setLangs((o) => (o === j ? null : j))} className={cn(langs === j && 'bg-muted')}>
                <LanguagesIcon />
              </IconButton>
              <IconButton label="Yukarı" onClick={() => onChange({ ...column, links: move(column.links, j, -1) })} disabled={j === 0}>
                <ArrowUpIcon />
              </IconButton>
              <IconButton label="Aşağı" onClick={() => onChange({ ...column, links: move(column.links, j, 1) })} disabled={j === column.links.length - 1}>
                <ArrowDownIcon />
              </IconButton>
              <IconButton label="Sil" onClick={() => onChange({ ...column, links: column.links.filter((_, k) => k !== j) })} className="text-muted-foreground hover:text-[#A3121B]">
                <Trash2Icon />
              </IconButton>
            </div>
            <Names value={l.label} textKey={l.key} open={langs === j} onChange={(label) => setLink(j, { label })} />
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2"
        disabled={column.links.length >= 12}
        onClick={() => onChange({ ...column, links: [...column.links, { label: {}, key: '', href: '/' }] })}
      >
        <PlusIcon /> Bağlantı ekle
      </Button>
    </li>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export default function NavigationPage() {
  const query = useNavigation();
  const save = useSaveNavigation();
  const reset = useResetNavigation();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Navigation | null>(null);
  const [translating, setTranslating] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  // The preview reloads after each save (it shows what visitors see, not the unsaved draft).
  const version = useMemo(() => JSON.stringify(query.data ?? null), [query.data]);
  const nav = draft ?? query.data;
  const dirty = Boolean(draft && JSON.stringify(draft) !== JSON.stringify(query.data));

  const change = (fn: (n: Navigation) => void) => {
    if (!nav) return;
    const next = structuredClone(nav);
    fn(next);
    setDraft(next);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    change((n) => {
      const ids = n.header.items.map((i) => i.id);
      n.header.items = arrayMove(n.header.items, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    });
  };

  /** Fills the empty languages of every name written in Turkish (Claude); nothing is saved until "Kaydet". */
  const translate = async () => {
    if (!nav) return;
    const next = structuredClone(nav);
    const names = [...next.header.items.map((i) => i.label), ...next.footer.columns.flatMap((c) => [c.title, ...c.links.map((l) => l.label)])];
    const fields = Object.fromEntries(names.map((t, i) => [`f${i}`, t.tr?.trim() ?? '']).filter(([k, v]) => v && OTHER.some((l) => !names[Number(k.slice(1))][l]?.trim())));
    if (!Object.keys(fields).length) {
      toast.success('Çevrilecek yeni ad yok. Türkçe adı boş olanlar zaten hazır çeviriyle görünüyor.');
      return;
    }
    setTranslating(true);
    try {
      const { translations } = await api.post<{ translations: Record<string, Record<string, string>> }>('/admin/ai/translate', { fields, kind: 'site menüsü bağlantı adları (kısa)', targets: OTHER });
      for (const [l, values] of Object.entries(translations)) {
        for (const [k, value] of Object.entries(values)) {
          const t = names[Number(k.slice(1))];
          if (t && !t[l]?.trim()) t[l] = value;
        }
      }
      setDraft(next);
      toast.success('Diller dolduruldu. Kaydetmeden önce göz atabilirsiniz.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTranslating(false);
    }
  };

  const addItem = (kind: NavKind) =>
    change((n) => {
      n.header.items.push({ id: newId(), kind, label: kind === 'link' ? { tr: 'Yeni bağlantı' } : {}, key: kind === 'link' ? '' : KIND_KEY[kind], href: kind === 'link' ? '/' : '', side: 'left', visible: true });
    });

  return (
    <>
      <PageHeader
        title="Üst menü ve alt bilgi"
        description="Menüleri ekleyin, sıralayın ve adlarını değiştirin. Boş bırakılan adlar sitenin kendi metniyle 11 dilde görünür. Kaydedince sağdaki önizleme yenilenir."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                confirm.ask({
                  title: 'Varsayılan menülere dönülsün mü?',
                  description: 'Üst menü ve alt bilgi ilk hallerine döner; eklediğiniz bağlantılar silinir.',
                  confirmLabel: 'Varsayılana dön',
                  destructive: true,
                  onConfirm: () => reset.mutateAsync().then(() => setDraft(null)),
                })
              }
            >
              <RotateCcwIcon /> Varsayılana dön
            </Button>
            <Button variant="outline" onClick={translate} disabled={!nav || translating}>
              <SparklesIcon /> {translating ? 'Çevriliyor…' : 'Dilleri doldur'}
            </Button>
            <Button onClick={() => draft && save.mutate(draft, { onSuccess: () => setDraft(null) })} disabled={!dirty || save.isPending}>
              <SaveIcon /> {save.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        }
      />
      <div className="xl:grid xl:grid-cols-[minmax(440px,560px)_1fr] xl:items-start xl:gap-5">
        <QueryState query={query}>
          {() =>
            nav ? (
              <Tabs defaultValue="header" className="gap-4">
                <TabsList>
                  <TabsTrigger value="header">Üst menü</TabsTrigger>
                  <TabsTrigger value="footer">Alt bilgi</TabsTrigger>
                </TabsList>
                <TabsContent value="header" className="space-y-3">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={nav.header.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      <ul className="space-y-2">
                        {nav.header.items.map((item, i) => (
                          <HeaderRow
                            key={item.id}
                            item={item}
                            onChange={(next) => change((n) => void (n.header.items[i] = next))}
                            onDelete={() => change((n) => void n.header.items.splice(i, 1))}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={nav.header.items.length >= 10} />}>
                      <PlusIcon /> Menüye ekle
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      {(Object.keys(KIND) as NavKind[]).map((k) => (
                        <DropdownMenuItem key={k} onClick={() => addItem(k)} className="flex-col items-start gap-0">
                          <span>{KIND[k].label}</span>
                          <span className="text-xs text-muted-foreground">{KIND[k].hint}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="rounded-xl border bg-card px-3 py-2">
                    <Toggle label="Dil seçici" checked={nav.header.languages} onChange={(v) => change((n) => void (n.header.languages = v))} />
                    <Toggle label="Hesap bağlantısı" checked={nav.header.account} onChange={(v) => change((n) => void (n.header.account = v))} />
                    <p className="pt-1 text-xs text-muted-foreground">Çanta (sepet) her zaman görünür. Telefonda menüdeki öğeler sol üstteki menü düğmesinde listelenir.</p>
                  </div>
                </TabsContent>
                <TabsContent value="footer" className="space-y-3">
                  <ul className="space-y-2">
                    {nav.footer.columns.map((column, i) => (
                      <FooterColumnCard
                        key={column.id}
                        column={column}
                        first={i === 0}
                        last={i === nav.footer.columns.length - 1}
                        onChange={(next) => change((n) => void (n.footer.columns[i] = next))}
                        onMove={(by) => change((n) => void (n.footer.columns = move(n.footer.columns, i, by)))}
                        onDelete={() =>
                          confirm.ask({
                            title: 'Sütun silinsin mi?',
                            description: 'Sütun ve içindeki bağlantılar alt bilgiden kalkar (kaydedince).',
                            confirmLabel: 'Sil',
                            destructive: true,
                            onConfirm: async () => change((n) => void n.footer.columns.splice(i, 1)),
                          })
                        }
                      />
                    ))}
                  </ul>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={nav.footer.columns.length >= 6}
                    onClick={() => change((n) => void n.footer.columns.push({ id: newId(), title: { tr: 'Yeni sütun' }, key: '', links: [], visible: true }))}
                  >
                    <PlusIcon /> Sütun ekle
                  </Button>
                  <div className="rounded-xl border bg-card px-3 py-2">
                    <Toggle label="Bülten kayıt formu" checked={nav.footer.newsletter} onChange={(v) => change((n) => void (n.footer.newsletter = v))} />
                    <Toggle label="Instagram bağlantısı" checked={nav.footer.instagram} onChange={(v) => change((n) => void (n.footer.instagram = v))} />
                    <Toggle label="Dil listesi" checked={nav.footer.languages} onChange={(v) => change((n) => void (n.footer.languages = v))} />
                    <Toggle label="Güvenli ödeme satırı" checked={nav.footer.payments} onChange={(v) => change((n) => void (n.footer.payments = v))} />
                    <p className="pt-1 text-xs text-muted-foreground">
                      Bağlantı: <code>/sayfa</code> ya da <code>https://…</code>. Boş bırakılırsa düz yazı olur, <code>#cookies</code> çerez tercihlerini açar.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            ) : null
          }
        </QueryState>
        <aside className="sticky top-20 hidden h-[calc(100dvh-6.5rem)] xl:block">
          <StorePreview version={version} />
        </aside>
      </div>
      {confirm.dialog}
    </>
  );
}
