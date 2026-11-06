'use client';

import { useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, LanguagesIcon, PanelTopIcon, PlusIcon, RotateCcwIcon, SaveIcon, SparklesIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StorePreview } from '@/components/content/store-preview';
import { ImageUrlField } from '@/components/shared/media-picker';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { QueryState } from '@/components/shared/query-state';
import { ToneBadge } from '@/components/shared/status-badge';
import { api, errorMessage } from '@/lib/api.client';
import { STORE_URL } from '@/lib/format';
import { DEFAULT_LOCALE, LOCALE_LABELS, LOCALES } from '@/lib/i18n';
import { useNavigation, useResetNavigation, useSaveNavigation } from '@/lib/queries/content';
import type { NavFooterColumn, NavHeaderItem, NavKind, NavPanel, Navigation } from '@/lib/types';
import { cn } from '@/lib/utils';

const KIND: Record<NavKind, { label: string; hint: string }> = {
  link: { label: 'Bağlantı', hint: 'Bir sayfaya ya da https:// adresine gider' },
  menu: { label: 'Açılır menü', hint: 'Başlık, bağlantılar ve fotoğraflarla açılan yeni bir menü' },
  bags: { label: 'Çantalar menüsü', hint: 'Modeller kendiliğinden listelenir; fotoğrafları siz seçersiniz' },
  expertise: { label: 'Uzmanlık menüsü', hint: 'Başlık, bağlantılar ve fotoğraflar' },
  stores: { label: 'Mağazalar menüsü', hint: 'Satış noktaları kendiliğinden listelenir' },
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
  'nav.byModel': 'Modeller',
  'home.ourStory': 'Hikâyemiz',
  'stockists.title': 'Satış noktaları',
  'stockists.online': 'Çevrimiçi',
};
const KIND_KEY: Record<Exclude<NavKind, 'link'>, string> = { bags: 'nav.bags', expertise: 'nav.expertise', stores: 'nav.stores', menu: '' };
const EMPTY_PANEL: NavPanel = { title: {}, titleKey: '', links: [], tiles: [] };
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
  const [content, setContent] = useState(false);
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
        {item.kind !== 'link' ? (
          <IconButton label="Menü içeriği" onClick={() => setContent((o) => !o)} className={cn(content && 'bg-muted')}>
            <PanelTopIcon />
          </IconButton>
        ) : null}
        <IconButton label="Sil" onClick={onDelete} className="text-muted-foreground hover:text-[#A3121B]">
          <Trash2Icon />
        </IconButton>
      </div>
      {item.kind !== 'link' && content ? <PanelEditor kind={item.kind} panel={item.panel ?? EMPTY_PANEL} onChange={(panel) => onChange({ ...item, panel })} /> : null}
      {item.kind === 'link' ? (
        <Input value={item.href} onChange={(e) => onChange({ ...item, href: e.target.value })} placeholder="/journal ya da https://…" aria-label="Bağlantı" className="mt-2 h-8" />
      ) : null}
      <Names value={item.label} textKey={item.key} open={langs} onChange={(label) => onChange({ ...item, label })} />
    </li>
  );
}

/**
 * What a picture menu shows: a heading, links under it and up to four pictures beside them (from the media library).
 * The bags menu lists the models and the stores menu the stockists by themselves, above the links.
 */
function PanelEditor({ kind, panel, onChange }: { kind: Exclude<NavKind, 'link'>; panel: NavPanel; onChange: (p: NavPanel) => void }) {
  const [langs, setLangs] = useState<string | null>(null);
  const toggle = (k: string) => setLangs((o) => (o === k ? null : k));
  const setLink = (j: number, patch: Partial<NavPanel['links'][number]>) => onChange({ ...panel, links: panel.links.map((l, k) => (k === j ? { ...l, ...patch } : l)) });
  const setTile = (j: number, patch: Partial<NavPanel['tiles'][number]>) => onChange({ ...panel, tiles: panel.tiles.map((t, k) => (k === j ? { ...t, ...patch } : t)) });
  return (
    <div className="mt-3 space-y-4 rounded-lg border bg-muted/30 p-3">
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Başlık</p>
        <div className="flex items-center gap-1.5">
          <Input
            value={panel.title.tr ?? ''}
            onChange={(e) => onChange({ ...panel, title: { ...panel.title, tr: e.target.value } })}
            placeholder={KEY_TR[panel.titleKey] ?? 'Boş: başlık yok'}
            maxLength={80}
            aria-label="Başlık"
            className="h-8 min-w-0 flex-1"
          />
          <IconButton label="Diller" onClick={() => toggle('title')} className={cn(langs === 'title' && 'bg-muted')}>
            <LanguagesIcon />
          </IconButton>
        </div>
        <Names value={panel.title} textKey={panel.titleKey} open={langs === 'title'} onChange={(title) => onChange({ ...panel, title })} />
        {kind === 'bags' || kind === 'stores' ? (
          <p className="mt-1.5 text-xs text-muted-foreground">{kind === 'bags' ? 'Modeller başlığın altında kendiliğinden listelenir.' : 'Satış noktaları başlığın altında kendiliğinden listelenir.'}</p>
        ) : null}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Bağlantılar</p>
        <ul className="space-y-2">
          {panel.links.map((l, j) => (
            <li key={j}>
              <div className="flex items-center gap-1.5">
                <Input value={l.label.tr ?? ''} onChange={(e) => setLink(j, { label: { ...l.label, tr: e.target.value } })} placeholder={KEY_TR[l.key] ?? 'Ad'} maxLength={80} aria-label="Ad" className="h-8 min-w-0 flex-1" />
                <Input value={l.href} onChange={(e) => setLink(j, { href: e.target.value })} placeholder="/sayfa ya da https://…" aria-label="Bağlantı" className="h-8 min-w-0 flex-1 text-xs" />
                <IconButton label="Diller" onClick={() => toggle(`l${j}`)} className={cn(langs === `l${j}` && 'bg-muted')}>
                  <LanguagesIcon />
                </IconButton>
                <IconButton label="Yukarı" onClick={() => onChange({ ...panel, links: move(panel.links, j, -1) })} disabled={j === 0}>
                  <ArrowUpIcon />
                </IconButton>
                <IconButton label="Aşağı" onClick={() => onChange({ ...panel, links: move(panel.links, j, 1) })} disabled={j === panel.links.length - 1}>
                  <ArrowDownIcon />
                </IconButton>
                <IconButton label="Sil" onClick={() => onChange({ ...panel, links: panel.links.filter((_, k) => k !== j) })} className="text-muted-foreground hover:text-[#A3121B]">
                  <Trash2Icon />
                </IconButton>
              </div>
              <Names value={l.label} textKey={l.key} open={langs === `l${j}`} onChange={(label) => setLink(j, { label })} />
            </li>
          ))}
        </ul>
        <Button type="button" variant="ghost" size="sm" className="mt-1" disabled={panel.links.length >= 12} onClick={() => onChange({ ...panel, links: [...panel.links, { label: {}, key: '', href: '/' }] })}>
          <PlusIcon /> Bağlantı ekle
        </Button>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Fotoğraflar (en çok 4)</p>
        <ul className="space-y-3">
          {panel.tiles.map((t, j) => (
            <li key={j} className="rounded-md border bg-card p-2">
              <ImageUrlField value={t.image} onChange={(image) => setTile(j, { image })} previewBase={STORE_URL} placeholder="Medyadan seçin" />
              <div className="mt-2 flex items-center gap-1.5">
                <Input
                  value={t.label.tr ?? ''}
                  onChange={(e) => setTile(j, { label: { ...t.label, tr: e.target.value } })}
                  placeholder={KEY_TR[t.key] ?? (t.href.startsWith('/products/') ? 'Boş: model adı' : 'Yazı (opsiyonel)')}
                  maxLength={80}
                  aria-label="Fotoğraf yazısı"
                  className="h-8 min-w-0 flex-1"
                />
                <Input value={t.href} onChange={(e) => setTile(j, { href: e.target.value })} placeholder="/sayfa" aria-label="Fotoğrafın bağlantısı" className="h-8 min-w-0 flex-1 text-xs" />
                <IconButton label="Diller" onClick={() => toggle(`t${j}`)} className={cn(langs === `t${j}` && 'bg-muted')}>
                  <LanguagesIcon />
                </IconButton>
                <IconButton label="Yukarı" onClick={() => onChange({ ...panel, tiles: move(panel.tiles, j, -1) })} disabled={j === 0}>
                  <ArrowUpIcon />
                </IconButton>
                <IconButton label="Aşağı" onClick={() => onChange({ ...panel, tiles: move(panel.tiles, j, 1) })} disabled={j === panel.tiles.length - 1}>
                  <ArrowDownIcon />
                </IconButton>
                <IconButton label="Sil" onClick={() => onChange({ ...panel, tiles: panel.tiles.filter((_, k) => k !== j) })} className="text-muted-foreground hover:text-[#A3121B]">
                  <Trash2Icon />
                </IconButton>
              </div>
              <Names value={t.label} textKey={t.key} open={langs === `t${j}`} onChange={(label) => setTile(j, { label })} />
            </li>
          ))}
        </ul>
        <Button type="button" variant="ghost" size="sm" className="mt-1" disabled={panel.tiles.length >= 4} onClick={() => onChange({ ...panel, tiles: [...panel.tiles, { image: '', label: {}, key: '', href: '/' }] })}>
          <PlusIcon /> Fotoğraf ekle
        </Button>
      </div>
    </div>
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
    const panels = next.header.items.flatMap((i) => (i.panel ? [i.panel.title, ...i.panel.links.map((l) => l.label), ...i.panel.tiles.map((t) => t.label)] : []));
    const names = [...next.header.items.map((i) => i.label), ...panels, ...next.footer.columns.flatMap((c) => [c.title, ...c.links.map((l) => l.label)])];
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
      n.header.items.push({
        id: newId(),
        kind,
        label: kind === 'link' ? { tr: 'Yeni bağlantı' } : kind === 'menu' ? { tr: 'Yeni menü' } : {},
        key: kind === 'link' ? '' : KIND_KEY[kind],
        href: kind === 'link' ? '/' : '',
        side: 'left',
        visible: true,
        ...(kind === 'menu' ? { panel: structuredClone(EMPTY_PANEL) } : {}),
      });
    });

  return (
    <>
      <PageHeader
        title="Üst menü ve alt bilgi"
        description="Menüleri ekleyin, sıralayın ve adlarını değiştirin; açılır menülerin başlık, bağlantı ve fotoğraflarını yanlarındaki menü içeriği düğmesiyle düzenleyin. Boş bırakılan adlar sitenin kendi metniyle 11 dilde görünür. Kaydedince sağdaki önizleme yenilenir."
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
