'use client';

import { useRouter } from 'next/navigation';
import { ProductForm } from '@/components/products/product-form';
import { PageHeader } from '@/components/shared/page-header';
import { useCreateProduct } from '@/lib/queries/catalog';

export default function NewProductPage() {
  const router = useRouter();
  const create = useCreateProduct();
  return (
    <>
      <PageHeader title="Yeni ürün" backHref="/products" backLabel="Ürünler" />
      <ProductForm
        onSubmit={async (body) => {
          const p = await create.mutateAsync(body);
          router.replace(`/products/${p.id}`);
        }}
        submitting={create.isPending}
        error={create.error}
      />
    </>
  );
}
