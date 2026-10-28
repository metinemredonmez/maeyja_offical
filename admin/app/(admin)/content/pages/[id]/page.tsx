'use client';

import { use } from 'react';
import { PageForm } from '@/components/content/page-form';
import { PageHeader } from '@/components/shared/page-header';
import { QueryState } from '@/components/shared/query-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { usePage, useSavePage } from '@/lib/queries/content';

export default function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = usePage(id);
  const save = useSavePage();
  return (
    <QueryState query={query}>
      {(page) => (
        <>
          <PageHeader
            title={
              <span className="flex items-center gap-2">
                {page.title} <StatusBadge kind="content" value={page.status} />
              </span>
            }
            description={<span className="font-mono text-xs">/pages/{page.slug}</span>}
            backHref="/content/pages"
            backLabel="Sayfalar"
          />
          <PageForm key={page.updatedAt} page={page} onSubmit={(body) => save.mutateAsync({ id: page.id, body })} submitting={save.isPending} error={save.error} />
        </>
      )}
    </QueryState>
  );
}
