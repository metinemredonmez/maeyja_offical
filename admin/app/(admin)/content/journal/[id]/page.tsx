'use client';

import { use } from 'react';
import { JournalForm } from '@/components/content/journal-form';
import { PageHeader } from '@/components/shared/page-header';
import { QueryState } from '@/components/shared/query-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { useJournalPost, useSaveJournalPost } from '@/lib/queries/content';

export default function EditJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useJournalPost(id);
  const save = useSaveJournalPost();
  return (
    <QueryState query={query}>
      {(post) => (
        <>
          <PageHeader
            title={
              <span className="flex items-center gap-2">
                {post.title} <StatusBadge kind="content" value={post.status} />
              </span>
            }
            description={<span className="font-mono text-xs">/journal/{post.slug}</span>}
            backHref="/content/journal"
            backLabel="Journal"
          />
          <JournalForm key={post.updatedAt} post={post} onSubmit={(body) => save.mutateAsync({ id: post.id, body })} submitting={save.isPending} error={save.error} />
        </>
      )}
    </QueryState>
  );
}
