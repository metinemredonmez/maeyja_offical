'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArchiveIcon, CameraIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductForm } from '@/components/products/product-form';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { QueryState } from '@/components/shared/query-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDeleteProduct, useDuplicateProduct, useProduct, useUpdateProduct } from '@/lib/queries/catalog';
import { STORE_URL } from '@/lib/format';
import { InstagramDialog } from '@/components/ai/instagram-dialog';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const query = useProduct(id);
  const update = useUpdateProduct(id);
  const dup = useDuplicateProduct();
  const del = useDeleteProduct();
  const confirm = useConfirm();
  const [insta, setInsta] = useState(false);

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
                  <Button variant="outline" size="sm" render={<a href={`${STORE_URL}/products/${product.slug}`} target="_blank" rel="noreferrer" />}>
                    <ExternalLinkIcon /> Sitede gör
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setInsta(true)}>
                  <CameraIcon /> Instagram
                </Button>
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
          {insta && <InstagramDialog open onOpenChange={setInsta} productId={product.id} images={product.images.map((i) => i.url)} />}
        </>
      )}
    </QueryState>
  );
}
