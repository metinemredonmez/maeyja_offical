'use client';

import { useRouter } from 'next/navigation';
import { PageForm } from '@/components/content/page-form';
import { PageHeader } from '@/components/shared/page-header';
import { useSavePage } from '@/lib/queries/content';

export default function NewPagePage() {
  const router = useRouter();
  const save = useSavePage();
  return (
    <>
      <PageHeader title="Yeni sayfa" backHref="/content/pages" backLabel="Sayfalar" />
      <PageForm
        onSubmit={async (body) => {
          const p = await save.mutateAsync({ body });
          router.replace(`/content/pages/${p.id}`);
        }}
        submitting={save.isPending}
        error={save.error}
      />
    </>
  );
}
