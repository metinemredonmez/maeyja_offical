'use client';

import { useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { HomeSectionDialog } from '@/components/content/home-section-dialog';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Thumb } from '@/components/shared/primitives';
import { EmptyState, QueryState } from '@/components/shared/query-state';
import { ToneBadge } from '@/components/shared/status-badge';
import { HOME_SECTION_TYPE } from '@/lib/labels';
import { useDeleteHomeSection, useHomeSections, useReorderHomeSections, useSaveHomeSection } from '@/lib/queries/content';
import type { HomeSection, HomeSectionType } from '@/lib/types';
import { cn } from '@/lib/utils';

function Row({ s, onEdit, onDelete, onToggle }: { s: HomeSection; onEdit: () => void; onDelete: () => void; onToggle: (v: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const meta = HOME_SECTION_TYPE[s.type];
  const summary =
    s.type === 'FEATURED_PRODUCTS' ? (s.payload?.productIds?.length ? `${s.payload.productIds.length} seçili ürün` : `öne çıkanlar · ${s.payload?.limit ?? 8} adet`) : s.type === 'COLLECTION' ? (s.payload?.collectionSlug ? `/${s.payload.collectionSlug}` : 'koleksiyon seçilmedi') : s.subtitle ?? '';
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('flex items-center gap-3 rounded-xl border bg-card p-3', isDragging && 'z-10 shadow-lg', !s.isActive && 'opacity-60')}>
      <button type="button" {...attributes} {...listeners} className="cursor-grab rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing" aria-label="Sürükle">
        <GripVerticalIcon className="size-4" />
      </button>
      <Thumb src={s.imageUrl} size="md" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm">
          <ToneBadge tone="neutral">{meta.label}</ToneBadge>
          <span className="truncate font-medium">{s.title || <span className="text-muted-foreground">(başlıksız)</span>}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">{summary}</p>
      </div>
      <Switch checked={s.isActive} onCheckedChange={onToggle} aria-label="Yayında" />
      <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Düzenle">
        <PencilIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Sil" className="text-muted-foreground hover:text-[#A3121B]">
        <Trash2Icon />
      </Button>
    </li>
  );
}

export default function HomeContentPage() {
  const query = useHomeSections();
  const save = useSaveHomeSection();
  const del = useDeleteHomeSection();
  const reorder = useReorderHomeSections();
  const confirm = useConfirm();
  // Optimistic order while the reorder request is in flight; otherwise the server order.
  const [override, setOverride] = useState<string[] | null>(null);
  const order = override ?? query.data?.map((s) => s.id) ?? [];
  const [editing, setEditing] = useState<{ section: HomeSection | null; type: HomeSectionType } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOverride(next);
    reorder.mutate(next, { onSettled: () => setOverride(null) });
  };

  return (
    <>
      <PageHeader
        title="Ana sayfa"
        description="Bölümleri sürükleyerek sıralayın; sıralama anında kaydedilir."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button />}>
              <PlusIcon /> Bölüm ekle
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {(Object.keys(HOME_SECTION_TYPE) as HomeSectionType[]).map((t) => (
                <DropdownMenuItem key={t} onClick={() => setEditing({ section: null, type: t })} className="flex-col items-start gap-0">
                  <span>{HOME_SECTION_TYPE[t].label}</span>
                  <span className="text-xs text-muted-foreground">{HOME_SECTION_TYPE[t].hint}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <QueryState query={query}>
        {(sections) => {
          const byId = new Map(sections.map((s) => [s.id, s]));
          const list = order.map((id) => byId.get(id)).filter((s): s is HomeSection => Boolean(s));
          if (list.length === 0) return <EmptyState title="Bölüm yok" description="Sağ üstten ilk bölümü ekleyin." />;
          return (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <ul className="space-y-2">
                  {list.map((s) => (
                    <Row
                      key={s.id}
                      s={s}
                      onEdit={() => setEditing({ section: s, type: s.type })}
                      onToggle={(v) => save.mutate({ id: s.id, body: { isActive: v } })}
                      onDelete={() => confirm.ask({ title: 'Bölüm silinsin mi?', description: `${HOME_SECTION_TYPE[s.type].label} bölümü ana sayfadan kalkar.`, confirmLabel: 'Sil', destructive: true, onConfirm: () => del.mutateAsync(s.id) })}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          );
        }}
      </QueryState>
      {editing && <HomeSectionDialog section={editing.section} type={editing.type} onClose={() => setEditing(null)} />}
      {confirm.dialog}
    </>
  );
}
