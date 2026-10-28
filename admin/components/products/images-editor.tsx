'use client';

import { useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { SimpleSelect } from '@/components/shared/form';
import { ImageUploader } from '@/components/shared/image-uploader';
import { MediaPicker } from '@/components/shared/media-picker';
import { ColorSwatch } from '@/components/shared/primitives';
import { useAddImage, useDeleteImage, useReorderImages, useUpdateImage, type ImageInput } from '@/lib/queries/catalog';
import type { Color, Media, ProductImage } from '@/lib/types';
import { cn } from '@/lib/utils';

export type LocalImage = ImageInput & { _key: string };

type Props = { colors: Color[] } & ({ mode: 'local'; value: LocalImage[]; onChange: (v: LocalImage[]) => void } | { mode: 'remote'; productId: string; images: ProductImage[] });

const key = () => Math.random().toString(36).slice(2, 10);

function SortableImage({
  id,
  img,
  colors,
  index,
  onAlt,
  onColor,
  onDelete,
}: {
  id: string;
  img: ImageInput;
  colors: Color[];
  index: number;
  onAlt: (alt: string) => void;
  onColor: (colorId: string | null) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [alt, setAlt] = useState(img.alt ?? ''); // parent re-keys on saved alt
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('flex flex-col gap-2 rounded-lg border bg-card p-2', isDragging && 'z-10 opacity-80 shadow-lg')}>
      <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.url} alt={img.alt ?? ''} className="size-full object-cover" loading="lazy" />
        <button type="button" {...attributes} {...listeners} className="absolute top-1 left-1 cursor-grab rounded bg-background/90 p-1 text-muted-foreground shadow-sm hover:text-foreground active:cursor-grabbing" aria-label="Sürükle">
          <GripVerticalIcon className="size-3.5" />
        </button>
        {index === 0 && <span className="absolute right-1 bottom-1 rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background">Kapak</span>}
      </div>
      <Input value={alt} onChange={(e) => setAlt(e.target.value)} onBlur={() => alt !== (img.alt ?? '') && onAlt(alt)} placeholder="Alt metin" className="h-7 text-xs" maxLength={200} aria-label="Alt metin" />
      <div className="flex items-center gap-1">
        <SimpleSelect
          value={img.colorId ?? ''}
          onChange={(v) => onColor(v || null)}
          allowEmpty
          emptyLabel="Tüm renkler"
          size="sm"
          ariaLabel="Görsel rengi"
          options={colors.map((c) => ({
            value: c.id,
            label: (
              <span className="flex items-center gap-1.5">
                <ColorSwatch hex={c.hex} hex2={c.hex2} size="sm" /> {c.name}
              </span>
            ),
          }))}
        />
        <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Görseli sil" className="shrink-0 text-muted-foreground hover:text-[#A3121B]">
          <Trash2Icon />
        </Button>
      </div>
    </li>
  );
}

export function ImagesEditor(props: Props) {
  const { colors } = props;
  const productId = props.mode === 'remote' ? props.productId : '';
  const add = useAddImage(productId);
  const update = useUpdateImage(productId);
  const del = useDeleteImage(productId);
  const reorder = useReorderImages(productId);
  const confirm = useConfirm();
  const [pickerOpen, setPickerOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const items: (ImageInput & { _key: string; id?: string })[] =
    props.mode === 'local' ? props.value : props.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt ?? undefined, colorId: i.colorId, width: i.width ?? undefined, height: i.height ?? undefined, sortOrder: i.sortOrder, _key: i.id }));
  const ids = items.map((i) => i._key);

  const fromMedia = (m: Media): ImageInput => ({ url: m.url, alt: m.alt ?? undefined, width: m.width ?? undefined, height: m.height ?? undefined });

  const addImage = (input: ImageInput) => {
    if (props.mode === 'local') props.onChange([...props.value, { ...input, _key: key() }]);
    else add.mutate(input);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    const next = arrayMove(items, from, to);
    if (props.mode === 'local') props.onChange(next as LocalImage[]);
    else reorder.mutate(next.map((i) => i.id!));
  };

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((img, i) => (
                <SortableImage
                  key={`${img._key}:${img.alt ?? ''}`}
                  id={img._key}
                  img={img}
                  index={i}
                  colors={colors}
                  onAlt={(alt) => {
                    if (props.mode === 'local') props.onChange(props.value.map((x, j) => (j === i ? { ...x, alt } : x)));
                    else update.mutate({ id: img.id!, body: { alt } });
                  }}
                  onColor={(colorId) => {
                    if (props.mode === 'local') props.onChange(props.value.map((x, j) => (j === i ? { ...x, colorId } : x)));
                    else update.mutate({ id: img.id!, body: { colorId } });
                  }}
                  onDelete={() => {
                    if (props.mode === 'local') {
                      props.onChange(props.value.filter((_, j) => j !== i));
                      return;
                    }
                    confirm.ask({ title: 'Görsel silinsin mi?', description: 'Görsel üründen kaldırılır; medya kütüphanesinde kalır.', confirmLabel: 'Sil', destructive: true, onConfirm: () => del.mutateAsync(img.id!) });
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <ImageUploader multiple compact onUploaded={(m) => addImage(fromMedia(m))} disabled={add.isPending} />
        <Button type="button" variant="outline" className="h-auto" onClick={() => setPickerOpen(true)}>
          Medyadan seç
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">İlk görsel kapak olarak kullanılır. Sürükleyerek sıralayın; renk atanan görseller o renk seçilince galeriye gelir.</p>
      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(m) => {
          if (m.mimeType.startsWith('video/')) return;
          addImage(fromMedia(m));
          setPickerOpen(false);
        }}
      />
      {confirm.dialog}
    </div>
  );
}
