'use client';

import { useMemo, useState } from 'react';
import { MinusIcon, PlusIcon, Trash2Icon, WandIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { SimpleSelect } from '@/components/shared/form';
import { ColorSwatch } from '@/components/shared/primitives';
import { useAddVariant, useDeleteVariant, useUpdateStock, useUpdateVariant, type VariantInput } from '@/lib/queries/catalog';
import { buildSku } from '@/lib/format';
import type { Color, ProductVariant } from '@/lib/types';
import { cn } from '@/lib/utils';

export type LocalVariant = VariantInput & { _key: string };

type Props = { colors: Color[]; productSlug: string } & (
  | { mode: 'local'; value: LocalVariant[]; onChange: (v: LocalVariant[]) => void }
  | { mode: 'remote'; productId: string; variants: ProductVariant[] }
);

const key = () => Math.random().toString(36).slice(2, 10);
const num = (v: string) => (v.trim() === '' ? null : Number(v));
const LOW = 3;

function colorOptions(colors: Color[]) {
  return colors.map((c) => ({
    value: c.id,
    label: (
      <span className="flex items-center gap-1.5">
        <ColorSwatch hex={c.hex} hex2={c.hex2} size="sm" /> {c.name}
      </span>
    ),
  }));
}

/** One editable row; in remote mode each field autosaves on blur/change. */
function VariantRow({
  v,
  colors,
  onPatch,
  onDelete,
  onStock,
  busy,
}: {
  v: VariantInput & { id?: string; stockAlertsWaiting?: number };
  colors: Color[];
  onPatch: (patch: Partial<VariantInput>) => void;
  onDelete: () => void;
  onStock?: (delta: number) => void;
  busy?: boolean;
}) {
  // Parent re-keys the row when server values change, so no sync effect is needed.
  const [draft, setDraft] = useState({ sku: v.sku, size: v.size ?? '', price: v.price ?? '', compareAtPrice: v.compareAtPrice ?? '', stock: String(v.stock) });

  const commit = (field: 'sku' | 'size' | 'price' | 'compareAtPrice' | 'stock') => {
    if (field === 'sku' && draft.sku.trim() !== v.sku) onPatch({ sku: draft.sku.trim() });
    if (field === 'size' && (draft.size.trim() || null) !== (v.size ?? null)) onPatch({ size: draft.size.trim() || null });
    if (field === 'price' && num(String(draft.price)) !== (v.price ?? null)) onPatch({ price: num(String(draft.price)) });
    if (field === 'compareAtPrice' && num(String(draft.compareAtPrice)) !== (v.compareAtPrice ?? null)) onPatch({ compareAtPrice: num(String(draft.compareAtPrice)) });
    if (field === 'stock') {
      const n = Number(draft.stock);
      if (Number.isInteger(n) && n >= 0 && n !== v.stock) onPatch({ stock: n });
      else if (!(Number.isInteger(n) && n >= 0)) setDraft((d) => ({ ...d, stock: String(v.stock) }));
    }
  };

  const low = v.stock <= LOW;
  return (
    <TableRow className={cn(busy && 'opacity-60', v.isActive === false && 'bg-muted/30')}>
      <TableCell className="min-w-36">
        <SimpleSelect value={v.colorId ?? ''} onChange={(id) => onPatch({ colorId: id || null })} options={colorOptions(colors)} allowEmpty emptyLabel="Renk yok" size="sm" ariaLabel="Renk" />
      </TableCell>
      <TableCell className="w-24">
        <Input value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })} onBlur={() => commit('size')} placeholder="—" className="h-7 text-xs" maxLength={16} aria-label="Beden" />
      </TableCell>
      <TableCell className="min-w-44">
        <Input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} onBlur={() => commit('sku')} className="h-7 font-mono text-xs" maxLength={64} aria-label="SKU" />
      </TableCell>
      <TableCell className="w-28">
        <Input type="number" min={0} step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} onBlur={() => commit('price')} placeholder="Temel" className="h-7 text-xs tabular-nums" aria-label="Fiyat" />
      </TableCell>
      <TableCell className="w-28">
        <Input type="number" min={0} step="0.01" value={draft.compareAtPrice} onChange={(e) => setDraft({ ...draft, compareAtPrice: e.target.value })} onBlur={() => commit('compareAtPrice')} placeholder="—" className="h-7 text-xs tabular-nums" aria-label="Eski fiyat" />
      </TableCell>
      <TableCell className="w-40">
        <div className="flex items-center gap-1">
          {onStock && (
            <Button type="button" variant="outline" size="icon-xs" onClick={() => onStock(-1)} disabled={v.stock <= 0 || busy} aria-label="Stok azalt">
              <MinusIcon />
            </Button>
          )}
          <Input
            type="number"
            min={0}
            step={1}
            value={draft.stock}
            onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
            onBlur={() => commit('stock')}
            className={cn('h-7 w-16 text-center text-xs tabular-nums', low && 'border-amber-400 bg-amber-50')}
            aria-label="Stok"
          />
          {onStock && (
            <Button type="button" variant="outline" size="icon-xs" onClick={() => onStock(1)} disabled={busy} aria-label="Stok artır">
              <PlusIcon />
            </Button>
          )}
          {(v.stockAlertsWaiting ?? 0) > 0 && (
            <Tooltip>
              <TooltipTrigger render={<span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800" />}>{v.stockAlertsWaiting}</TooltipTrigger>
              <TooltipContent>{v.stockAlertsWaiting} kişi stok bildirimi bekliyor</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TableCell>
      <TableCell className="w-16">
        <Switch size="sm" checked={v.isActive !== false} onCheckedChange={(c) => onPatch({ isActive: c })} aria-label="Aktif" />
      </TableCell>
      <TableCell className="w-10 text-right">
        <Button type="button" variant="ghost" size="icon-xs" onClick={onDelete} aria-label="Varyantı sil" className="text-muted-foreground hover:text-[#A3121B]">
          <Trash2Icon />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function MatrixDialog({
  open,
  onOpenChange,
  colors,
  productSlug,
  existing,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  colors: Color[];
  productSlug: string;
  existing: { colorId?: string | null; size?: string | null }[];
  onGenerate: (rows: VariantInput[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [sizes, setSizes] = useState('');
  const [stock, setStock] = useState('0');

  const preview = useMemo(() => {
    const sizeList = sizes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const colorList = picked.length ? picked : [null];
    const sizeAxis = sizeList.length ? sizeList : [null];
    const rows: VariantInput[] = [];
    for (const colorId of colorList) {
      const color = colors.find((c) => c.id === colorId);
      for (const size of sizeAxis) {
        const dup = existing.some((e) => (e.colorId ?? null) === colorId && (e.size ?? null) === size);
        if (dup) continue;
        rows.push({ sku: buildSku(productSlug || 'urun', color?.slug, size), colorId, size, stock: Math.max(0, Number(stock) || 0), isActive: true });
      }
    }
    return rows;
  }, [picked, sizes, stock, colors, productSlug, existing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Varyant matrisi oluştur</DialogTitle>
          <DialogDescription>Renk × beden kombinasyonlarını otomatik SKU ile ekler. Var olan kombinasyonlar atlanır.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label className="text-xs">Renkler</Label>
            <div className="mt-1.5 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-lg border p-2">
              {colors.length === 0 && <p className="col-span-2 text-xs text-muted-foreground">Önce Katalog → Renkler altından renk ekleyin.</p>}
              {colors.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                  <Checkbox checked={picked.includes(c.id)} onCheckedChange={(v) => setPicked((p) => (v ? [...p, c.id] : p.filter((x) => x !== c.id)))} />
                  <ColorSwatch hex={c.hex} hex2={c.hex2} size="sm" />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div>
              <Label htmlFor="matrix-sizes" className="text-xs">
                Bedenler (virgülle)
              </Label>
              <Input id="matrix-sizes" value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="Boş bırakılabilir · S, M, L" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="matrix-stock" className="text-xs">
                Başlangıç stok
              </Label>
              <Input id="matrix-stock" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-xs">
            <p className="mb-1 font-medium">{preview.length} varyant oluşturulacak</p>
            <ul className="max-h-28 space-y-0.5 overflow-y-auto font-mono">
              {preview.slice(0, 40).map((r) => (
                <li key={r.sku}>{r.sku}</li>
              ))}
              {preview.length > 40 && <li>…</li>}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={preview.length === 0}
            onClick={() => {
              onGenerate(preview);
              onOpenChange(false);
              setPicked([]);
              setSizes('');
            }}
          >
            Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VariantsEditor(props: Props) {
  const { colors, productSlug } = props;
  const [matrixOpen, setMatrixOpen] = useState(false);
  const confirm = useConfirm();
  const productId = props.mode === 'remote' ? props.productId : '';
  const add = useAddVariant(productId);
  const update = useUpdateVariant(productId);
  const del = useDeleteVariant(productId);
  const stock = useUpdateStock(productId);

  const rows: (VariantInput & { id?: string; _key: string; stockAlertsWaiting?: number })[] =
    props.mode === 'local'
      ? props.value
      : props.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          colorId: v.colorId,
          size: v.size,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          stock: v.stock,
          barcode: v.barcode ?? undefined,
          weightGrams: v.weightGrams ?? undefined,
          isActive: v.isActive,
          sortOrder: v.sortOrder,
          stockAlertsWaiting: v.stockAlertsWaiting,
          _key: v.id,
        }));

  const addRow = (input?: Partial<VariantInput>) => {
    const base: VariantInput = { sku: buildSku(productSlug || 'urun') + `-${rows.length + 1}`, colorId: null, size: null, stock: 0, isActive: true, ...input };
    if (props.mode === 'local') props.onChange([...props.value, { ...base, _key: key() }]);
    else add.mutate(base);
  };

  const onGenerate = async (generated: VariantInput[]) => {
    if (props.mode === 'local') {
      props.onChange([...props.value, ...generated.map((g) => ({ ...g, _key: key() }))]);
      return;
    }
    let ok = 0;
    for (const g of generated) {
      try {
        await add.mutateAsync(g);
        ok++;
      } catch {
        /* toast shown by mutation */
      }
    }
    if (ok) toast.success(`${ok} varyant eklendi`);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Renk</TableHead>
              <TableHead className="text-xs">Beden</TableHead>
              <TableHead className="text-xs">SKU</TableHead>
              <TableHead className="text-xs">Fiyat (₺)</TableHead>
              <TableHead className="text-xs">Eski fiyat</TableHead>
              <TableHead className="text-xs">Stok</TableHead>
              <TableHead className="text-xs">Aktif</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                  Henüz varyant yok. En az bir varyant (renk/beden) gerekli.
                </TableCell>
              </TableRow>
            )}
            {rows.map((v, i) => (
              <VariantRow
                key={`${v._key}:${v.sku}:${v.size ?? ''}:${v.price ?? ''}:${v.compareAtPrice ?? ''}:${v.stock}`}
                v={v}
                colors={colors}
                busy={props.mode === 'remote' && (update.isPending || stock.isPending)}
                onPatch={(patch) => {
                  if (props.mode === 'local') props.onChange(props.value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  else if (v.id) update.mutate({ id: v.id, body: patch });
                }}
                onStock={props.mode === 'remote' && v.id ? (delta) => stock.mutate({ id: v.id!, delta }) : undefined}
                onDelete={() => {
                  if (props.mode === 'local') {
                    props.onChange(props.value.filter((_, j) => j !== i));
                    return;
                  }
                  confirm.ask({
                    title: 'Varyant silinsin mi?',
                    description: `${v.sku} sepetlerden kaldırılır; geçmiş siparişler etkilenmez.`,
                    confirmLabel: 'Sil',
                    destructive: true,
                    onConfirm: () => del.mutateAsync(v.id!),
                  });
                }}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => addRow()} disabled={add.isPending}>
          <PlusIcon /> Varyant ekle
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setMatrixOpen(true)}>
          <WandIcon /> Matris oluştur
        </Button>
        <p className="self-center text-xs text-muted-foreground">
          {props.mode === 'remote' ? 'Alanlar odak kaybında otomatik kaydedilir.' : 'Varyantlar ürünle birlikte kaydedilir.'} SKU formatı: MY-ÜRÜN-RENK-BEDEN
        </p>
      </div>
      <MatrixDialog open={matrixOpen} onOpenChange={setMatrixOpen} colors={colors} productSlug={productSlug} existing={rows} onGenerate={onGenerate} />
      {confirm.dialog}
    </div>
  );
}
