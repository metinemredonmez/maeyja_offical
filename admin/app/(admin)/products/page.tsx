'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArchiveIcon, CopyIcon, MoreHorizontalIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { SimpleSelect } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { Money, Thumb } from '@/components/shared/primitives';
import { StatusBadge, ToneBadge } from '@/components/shared/status-badge';
import { useListParams } from '@/hooks/use-list-params';
import { PRODUCT_STATUS } from '@/lib/labels';
import { useCategories, useDeleteProduct, useDuplicateProduct, useProducts } from '@/lib/queries/catalog';
import type { ProductListItem, ProductStatus } from '@/lib/types';

const DEFAULTS = { q: '', status: '', categoryId: '', lowStock: '' };

function ProductsList() {
  const router = useRouter();
  const { params, set, page, limit } = useListParams(DEFAULTS);
  const query = useProducts({ page, limit, q: params.q || undefined, status: (params.status as ProductStatus) || undefined, categoryId: params.categoryId || undefined, lowStock: params.lowStock === '1' });
  const categories = useCategories();
  const del = useDeleteProduct();
  const dup = useDuplicateProduct();
  const confirm = useConfirm();

  const columns: Column<ProductListItem>[] = [
    {
      key: 'name',
      header: 'Ürün',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <Thumb src={p.thumbnail} alt={p.name} />
          <div className="min-w-0">
            <p className="truncate font-medium">{p.name}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{p.slug}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Kategori', cell: (p) => <span className="text-muted-foreground">{p.category?.name ?? '—'}</span> },
    { key: 'price', header: 'Fiyat', align: 'right', cell: (p) => <Money value={p.basePrice} /> },
    { key: 'variants', header: 'Varyant', align: 'right', cell: (p) => <span className="tabular-nums">{p.variantCount}</span> },
    {
      key: 'stock',
      header: 'Stok',
      align: 'right',
      cell: (p) => (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          {p.totalStock}
          {p.lowStock && <ToneBadge tone="warning">düşük</ToneBadge>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      cell: (p) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge kind="product" value={p.status} />
          {p.isFeatured && <ToneBadge tone="neutral">öne çıkan</ToneBadge>}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="İşlemler" />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href={`/products/${p.id}`} />}>
              <PencilIcon /> Düzenle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => dup.mutate(p.id, { onSuccess: (copy) => router.push(`/products/${copy.id}`) })}>
              <CopyIcon /> Kopyala
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                confirm.ask({
                  title: `"${p.name}" arşivlensin mi?`,
                  description: 'Ürün vitrinden kalkar, sepetlerden çıkarılır. Geçmiş siparişler korunur.',
                  confirmLabel: 'Arşivle',
                  destructive: true,
                  onConfirm: () => del.mutateAsync(p.id),
                })
              }
            >
              <ArchiveIcon /> Arşivle
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Ürünler"
        description={query.data ? `${query.data.total} ürün` : undefined}
        actions={
          <Button render={<Link href="/products/new" />}>
            <PlusIcon /> Yeni ürün
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(p) => p.id}
        rowHref={(p) => `/products/${p.id}`}
        total={query.data?.total}
        page={page}
        limit={limit}
        onPageChange={(p) => set({ page: p })}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        emptyTitle="Ürün bulunamadı"
        emptyDescription={params.q || params.status || params.categoryId || params.lowStock ? 'Filtreleri temizleyip tekrar deneyin.' : 'İlk ürününüzü ekleyin.'}
        search={{ value: params.q, onChange: (q) => set({ q }), placeholder: 'Ad, slug veya SKU…' }}
        toolbar={
          <>
            <SimpleSelect value={params.status} onChange={(v) => set({ status: v })} allowEmpty emptyLabel="Tüm durumlar" className="w-40" options={(Object.keys(PRODUCT_STATUS) as ProductStatus[]).map((s) => ({ value: s, label: PRODUCT_STATUS[s].label }))} ariaLabel="Durum filtresi" />
            <SimpleSelect value={params.categoryId} onChange={(v) => set({ categoryId: v })} allowEmpty emptyLabel="Tüm kategoriler" className="w-44" options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} ariaLabel="Kategori filtresi" />
            <Label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={params.lowStock === '1'} onCheckedChange={(v) => set({ lowStock: v ? '1' : '' })} /> Düşük stok
            </Label>
          </>
        }
      />
      {confirm.dialog}
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsList />
    </Suspense>
  );
}
