'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ArchiveIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductForm } from '@/components/products/product-form';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { QueryState } from '@/components/shared/query-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDeleteProduct, useDuplicateProduct, useProduct, useUpdateProduct } from '@/lib/queries/catalog';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const query = useProduct(id);
  const update = useUpdateProduct(id);
  const dup = useDuplicateProduct();
  const del = useDeleteProduct();
  const confirm = useConfirm();

  return (
    <QueryState query={query}>
      {(product) => (
        <>
          <PageHeader
            title={
              <span className="flex items-center gap-2">
                {product.name} <StatusBadge kind="product" value={product.status} />
              </span>
            }
            description={
              <span className="font-mono text-xs">
                {product.slug} · {product.variants.length} varyant · {product.images.length} görsel
              </span>
            }
            backHref="/products"
            backLabel="Ürünler"
            actions={
              <>
                {product.status === 'ACTIVE' && (
                  <Button variant="outline" size="sm" render={<a href={`${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3001'}/products/${product.slug}`} target="_blank" rel="noreferrer" />}>
                    <ExternalLinkIcon /> Sitede gör
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => dup.mutate(product.id, { onSuccess: (copy) => router.push(`/products/${copy.id}`) })} disabled={dup.isPending}>
                  <CopyIcon /> Kopyala
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[#A3121B]"
                  onClick={() =>
                    confirm.ask({
                      title: `"${product.name}" arşivlensin mi?`,
                      description: 'Ürün vitrinden kalkar ve sepetlerden çıkarılır. Geçmiş siparişler korunur.',
                      confirmLabel: 'Arşivle',
                      destructive: true,
                      onConfirm: async () => {
                        await del.mutateAsync(product.id);
                        router.replace('/products');
                      },
                    })
                  }
                >
                  <ArchiveIcon /> Arşivle
                </Button>
              </>
            }
          />
          <ProductForm key={product.updatedAt} product={product} onSubmit={(body) => update.mutateAsync(body)} submitting={update.isPending} error={update.error} />
          {confirm.dialog}
        </>
      )}
    </QueryState>
  );
}
