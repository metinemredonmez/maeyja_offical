'use client';

import { useMemo } from 'react';
import { AlertCircleIcon, ArrowLeftIcon, ForwardIcon, MailIcon, MailOpenIcon, PaperclipIcon, ReplyAllIcon, ReplyIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DateTime } from '@/components/shared/primitives';
import { ErrorState } from '@/components/shared/query-state';
import type { ComposeRequest } from '@/components/mail/compose-dialog';
import { formatBytes } from '@/lib/format';
import { emailDocument } from '@/lib/mail';
import { useDeleteMailMessage, useMailMessage, useMarkMailMessage } from '@/lib/queries/mail';
import type { MailAddress, MailMessage } from '@/lib/types';

function Addresses({ label, list }: { label: string; list: MailAddress[] }) {
  if (list.length === 0) return null;
  return (
    <div className="grid grid-cols-[64px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">
        {list.map((a, i) => (
          <span key={`${a.address}-${i}`}>
            {i > 0 && ', '}
            {a.name ? (
              <>
                <span className="font-medium">{a.name}</span> <span className="text-muted-foreground">&lt;{a.address}&gt;</span>
              </>
            ) : (
              <span className="font-medium">{a.address}</span>
            )}
          </span>
        ))}
      </dd>
    </div>
  );
}

/** Sanitised HTML in a sandboxed iframe (no scripts, opaque origin); plain text as text. */
function MessageBody({ m }: { m: MailMessage }) {
  const doc = useMemo(() => (m.html ? emailDocument(m.html) : null), [m.html]);
  if (doc)
    return (
      // allow-popups(+escape) only lets links open in a new tab; scripts, forms and same-origin stay blocked.
      <iframe title="E-posta içeriği" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} className="w-full flex-1 border-0 bg-white" />
    );
  if (m.text) return <pre className="flex-1 px-5 py-4 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap">{m.text}</pre>;
  return <p className="flex-1 px-5 py-4 text-sm text-muted-foreground">(içerik yok)</p>;
}

function MessageView({ m, onBack, onCompose, onGone }: { m: MailMessage; onBack: () => void; onCompose: (r: ComposeRequest) => void; onGone: () => void }) {
  const mark = useMarkMailMessage();
  const del = useDeleteMailMessage();
  const confirm = useConfirm();
  const inbound = m.direction === 'INBOUND';
  const replyToDiffers = m.replyTo.length > 0 && m.replyTo.some((a) => a.address.toLowerCase() !== m.from.address.toLowerCase());

  return (
    <article className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="space-y-3 border-b p-4">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon-sm" className="-ml-1 lg:hidden" onClick={onBack} aria-label="Listeye dön">
            <ArrowLeftIcon />
          </Button>
          <h2 className="min-w-0 flex-1 text-base font-semibold break-words">{m.subject || '(konu yok)'}</h2>
          <DateTime value={m.date} className="mt-0.5 shrink-0 text-xs text-muted-foreground" />
        </div>
        <dl className="grid gap-0.5 text-xs">
          <Addresses label="Kimden" list={[m.from]} />
          <Addresses label="Kime" list={m.to} />
          <Addresses label="Bilgi" list={m.cc} />
          {replyToDiffers && <Addresses label="Yanıt" list={m.replyTo} />}
          <div className="grid grid-cols-[64px_1fr] gap-2">
            <dt className="text-muted-foreground">Hesap</dt>
            <dd className="min-w-0 truncate">{m.accountEmail}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" onClick={() => onCompose({ mode: 'reply', original: m })}>
            <ReplyIcon /> Yanıtla
          </Button>
          <Button variant="outline" size="sm" onClick={() => onCompose({ mode: 'replyAll', original: m })}>
            <ReplyAllIcon /> Tümünü yanıtla
          </Button>
          <Button variant="outline" size="sm" onClick={() => onCompose({ mode: 'forward', original: m })}>
            <ForwardIcon /> İlet
          </Button>
          {inbound && (
            <Button
              variant="ghost"
              size="sm"
              disabled={mark.isPending}
              onClick={() =>
                mark.mutate(
                  { id: m.id, isRead: !m.isRead },
                  {
                    // Leave the reader after "unread": reopening is what marks it read again.
                    onSuccess: (_, v) => {
                      if (!v.isRead) onGone();
                    },
                  },
                )
              }
            >
              {m.isRead ? <MailIcon /> : <MailOpenIcon />} {m.isRead ? 'Okunmadı yap' : 'Okundu yap'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-[#A3121B]"
            onClick={() =>
              confirm.ask({
                title: 'E-posta silinsin mi?',
                description: 'Yalnızca panelden kaldırılır; posta sunucusundaki kopyası silinmez.',
                confirmLabel: 'Sil',
                destructive: true,
                onConfirm: async () => {
                  await del.mutateAsync(m.id);
                  onGone();
                },
              })
            }
          >
            <Trash2Icon /> Sil
          </Button>
        </div>
        {m.status === 'FAILED' && (
          <p role="alert" className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
            Gönderilemedi{m.error ? `: ${m.error}` : ''}
          </p>
        )}
        {m.attachments.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Ekler">
            {m.attachments.map((a) => (
              <li key={a.index}>
                <a
                  href={`/api/admin/mail/messages/${m.id}/attachments/${a.index}`}
                  download
                  className="inline-flex max-w-72 items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  title={`${a.filename} indir`}
                >
                  <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{a.filename}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">{formatBytes(a.size)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </header>
      <div className="flex min-h-[70dvh] flex-1 flex-col lg:min-h-[420px]">
        <MessageBody m={m} />
      </div>
      {confirm.dialog}
    </article>
  );
}

function ReaderSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Yükleniyor">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-7 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** Right pane: loads the message (which marks it read) and offers reply / forward / unread / delete. */
export function MessageReader({ id, onBack, onCompose, onGone }: { id: string; onBack: () => void; onCompose: (r: ComposeRequest) => void; onGone: () => void }) {
  const query = useMailMessage(id);
  if (query.isPending) return <ReaderSkeleton />;
  if (query.isError)
    return (
      <div className="space-y-3 p-4">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={onBack}>
          <ArrowLeftIcon /> Listeye dön
        </Button>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  return <MessageView m={query.data} onBack={onBack} onCompose={onCompose} onGone={onGone} />;
}
