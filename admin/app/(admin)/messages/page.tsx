'use client';

import { Suspense, useState } from 'react';
import { MailIcon, MailOpenIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { Pagination } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime } from '@/components/shared/primitives';
import { EmptyState, QueryState } from '@/components/shared/query-state';
import { ToneBadge } from '@/components/shared/status-badge';
import { useListParams } from '@/hooks/use-list-params';
import { useDeleteMessage, useMarkMessage, useMessages } from '@/lib/queries/marketing';
import type { ContactMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

function MessageDetail({ m, onClose }: { m: ContactMessage; onClose: () => void }) {
  const mark = useMarkMessage();
  const del = useDeleteMessage();
  const confirm = useConfirm();
  return (
    <article className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{m.subject || '(konu yok)'}</h2>
          <p className="text-sm">
            {m.name} ·{' '}
            <a href={`mailto:${m.email}`} className="underline underline-offset-2">
              {m.email}
            </a>
            {m.phone && <span className="text-muted-foreground"> · {m.phone}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            <DateTime value={m.createdAt} />
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => mark.mutate({ id: m.id, isRead: !m.isRead })}>
            {m.isRead ? <MailIcon /> : <MailOpenIcon />} {m.isRead ? 'Okunmadı yap' : 'Okundu'}
          </Button>
          <Button variant="outline" size="sm" render={<a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject ?? 'MAEYJA'}`)}`} />}>
            Yanıtla
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#A3121B]"
            onClick={() =>
              confirm.ask({
                title: 'Mesaj silinsin mi?',
                description: 'Mesaj kalıcı olarak silinir.',
                confirmLabel: 'Sil',
                destructive: true,
                onConfirm: async () => {
                  await del.mutateAsync(m.id);
                  onClose();
                },
              })
            }
          >
            <Trash2Icon /> Sil
          </Button>
        </div>
      </header>
      {/* Customer text is rendered as text, never HTML. */}
      <p className="p-4 text-sm leading-relaxed whitespace-pre-wrap">{m.message}</p>
      {confirm.dialog}
    </article>
  );
}

function Inbox() {
  const { set, page, limit } = useListParams({});
  const query = useMessages({ page, limit });
  const mark = useMarkMessage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = query.data?.items.find((m) => m.id === selectedId) ?? null;

  const open = (m: ContactMessage) => {
    setSelectedId(m.id);
    if (!m.isRead) mark.mutate({ id: m.id, isRead: true });
  };

  return (
    <>
      <PageHeader
        title="Mesajlar"
        description={
          query.data ? (
            <>
              {query.data.total} mesaj {query.data.unread > 0 && <ToneBadge tone="warning">{query.data.unread} okunmamış</ToneBadge>}
            </>
          ) : undefined
        }
      />
      <QueryState query={query}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState title="Gelen kutusu boş" description="İletişim formundan gelen mesajlar burada listelenir." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
              <div className="space-y-3">
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                  {data.items.map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => open(m)} className={cn('flex w-full flex-col gap-0.5 px-3 py-2.5 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted', selectedId === m.id && 'bg-muted', !m.isRead && 'border-l-2 border-l-foreground')} aria-current={selectedId === m.id}>
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn('truncate text-sm', !m.isRead && 'font-semibold')}>{m.name}</span>
                          <DateTime value={m.createdAt} mode="relative" className="shrink-0 text-[11px] text-muted-foreground" />
                        </span>
                        <span className="truncate text-xs">{m.subject || '(konu yok)'}</span>
                        <span className="truncate text-xs text-muted-foreground">{m.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <Pagination page={page} limit={limit} total={data.total} onPageChange={(p) => set({ page: p })} />
              </div>
              {selected ? <MessageDetail m={selected} onClose={() => setSelectedId(null)} /> : <div className="hidden rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground lg:block">Okumak için bir mesaj seçin</div>}
            </div>
          )
        }
      </QueryState>
    </>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <Inbox />
    </Suspense>
  );
}
