'use client';

import { useRouter } from 'next/navigation';
import { JournalForm } from '@/components/content/journal-form';
import { PageHeader } from '@/components/shared/page-header';
import { useSaveJournalPost } from '@/lib/queries/content';

export default function NewJournalPage() {
  const router = useRouter();
  const save = useSaveJournalPost();
  return (
    <>
      <PageHeader title="Yeni yazı" backHref="/content/journal" backLabel="Journal" />
      <JournalForm
        onSubmit={async (body) => {
          const p = await save.mutateAsync({ body });
          router.replace(`/content/journal/${p.id}`);
        }}
        submitting={save.isPending}
        error={save.error}
      />
    </>
  );
}
