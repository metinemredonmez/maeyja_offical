'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { InboxIcon, MailIcon, MailPlusIcon, PaperclipIcon, RefreshCwIcon, SendIcon, SettingsIcon, SquarePenIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ComposeDialog, type ComposeRequest } from '@/components/mail/compose-dialog';
import { MessageReader } from '@/components/mail/message-reader';
import { Pagination, SearchInput } from '@/components/shared/data-table';
import { SimpleSelect } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/shared/query-state';
import { ToneBadge } from '@/components/shared/status-badge';
import { useListParams } from '@/hooks/use-list-params';
import { formatDateTime, formatNumber } from '@/lib/format';
import { addressLabel, mailListDate } from '@/lib/mail';
import { useMailAccounts, useMailMessages, useMailUnreadCount, useSyncMail } from '@/lib/queries/mail';
import type { MailAccount, MailFolder, MailMessageSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

const DEFAULTS = { folder: 'INBOX', accountId: '', q: '', unread: '', id: '' };

function MessageRow({ m, folder, active, showAccount, onSelect }: { m: MailMessageSummary; folder: MailFolder; active: boolean; showAccount: boolean; onSelect: () => void }) {
  const unread = !m.isRead;
  const who = folder === 'SENT' ? `Kime: ${m.to.map(addressLabel).join(', ') || '—'}` : addressLabel(m.from);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active}
      className={cn(
        'flex w-full flex-col gap-0.5 border-l-2 border-l-transparent px-3 py-2.5 text-left outline-none hover:bg-muted/60 focus-visible:bg-muted',
        active && 'bg-muted',
        unread && 'border-l-foreground',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={cn('truncate text-sm', unread && 'font-semibold')}>{who}</span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          {m.hasAttachments && (
            <>
              <PaperclipIcon className="size-3" />
              <span className="sr-only">Ekli</span>
            </>
          )}
          <time dateTime={m.date} title={formatDateTime(m.date)}>
            {mailListDate(m.date)}
          </time>
        </span>
      </span>
      <span className={cn('truncate text-xs', unread ? 'font-medium' : 'text-foreground/80')}>{m.subject || '(konu yok)'}</span>
      <span className="truncate text-xs text-muted-foreground">{m.snippet || '—'}</span>
      {showAccount && <span className="truncate text-[10px] text-muted-foreground">{m.accountEmail}</span>}
    </button>
  );
}

function NoAccounts() {
  return (
    <EmptyState
      icon={<MailPlusIcon className="size-6" />}
      title="Henüz e-posta hesabı yok"
      description="Gelen kutusunu kullanmak için önce bir hesap ekleyin: bu sunucudaki bir posta kutusu ya da bir Gmail hesabı. E-postalar IMAP ile çekilir, SMTP ile gönderilir."
      action={
        <Button render={<Link href="/mail/accounts" />}>
          <SettingsIcon /> Hesap ekle
        </Button>
      }
    />
  );
}

function Mailbox({ accounts }: { accounts: MailAccount[] }) {
  const { params, set, page, limit } = useListParams(DEFAULTS);
  const folder: MailFolder = params.folder === 'SENT' ? 'SENT' : 'INBOX';
  const unreadOnly = folder === 'INBOX' && params.unread === '1';
  const filtered = Boolean(params.q || params.accountId || unreadOnly);
  const query = useMailMessages({ folder, accountId: params.accountId || undefined, q: params.q || undefined, unread: unreadOnly, page, limit });
  const unread = useMailUnreadCount();
  const sync = useSyncMail();
  const [compose, setCompose] = useState<ComposeRequest | null>(null);
  const usable = accounts.filter((a) => a.isActive);
  const selectedId = params.id || null;
  // Selecting / closing a message must not reset the list page.
  const keepPage = page > 1 ? page : undefined;
  const select = (id: string) => set({ id, page: keepPage });
  const unreadCount = unread.data?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Gelen kutusu"
        description={
          <>
            {accounts.length === 1 ? accounts[0].email : `${accounts.length} hesap`} {unreadCount > 0 && <ToneBadge tone="warning">{formatNumber(unreadCount)} okunmamış</ToneBadge>}
          </>
        }
        actions={
          <>
            <Button variant="outline" render={<Link href="/mail/accounts" />}>
              <SettingsIcon /> Hesaplar
            </Button>
            <Button variant="outline" disabled={sync.isPending} onClick={() => sync.mutate()} title="Yeni e-postaları şimdi çek (otomatik olarak 3 dakikada bir çekilir)">
              <RefreshCwIcon className={cn(sync.isPending && 'animate-spin')} /> {sync.isPending ? 'Çekiliyor…' : 'Yenile'}
            </Button>
            <Button disabled={usable.length === 0} onClick={() => setCompose({ mode: 'new' })}>
              <SquarePenIcon /> Yeni e-posta
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs value={folder} onValueChange={(v) => set({ folder: String(v), id: '', unread: '' })}>
          <TabsList>
            <TabsTrigger value="INBOX" className="px-2.5">
              <InboxIcon /> Gelen
              {unreadCount > 0 && <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(unreadCount)}</span>}
            </TabsTrigger>
            <TabsTrigger value="SENT" className="px-2.5">
              <SendIcon /> Gönderilen
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <SimpleSelect
          value={params.accountId}
          onChange={(accountId) => set({ accountId })}
          allowEmpty
          emptyLabel="Tüm hesaplar"
          className="w-52"
          ariaLabel="Hesap"
          options={accounts.map((a) => ({
            value: a.id,
            label: (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{a.email}</span>
                {a.unreadCount > 0 && <span className="text-xs text-muted-foreground tabular-nums">{a.unreadCount}</span>}
              </span>
            ),
          }))}
        />
        <SearchInput value={params.q} onChange={(q) => set({ q })} placeholder="Konu, gönderen, içerik ara…" className="max-w-64" />
        {folder === 'INBOX' && (
          <Button variant={unreadOnly ? 'secondary' : 'outline'} aria-pressed={unreadOnly} onClick={() => set({ unread: unreadOnly ? '' : '1' })}>
            <MailIcon /> Okunmamış
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:h-[calc(100dvh-14rem)] lg:min-h-[520px] lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section aria-label="E-posta listesi" className={cn('flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card', selectedId && 'hidden lg:flex')}>
          {query.isPending ? (
            <LoadingBlock rows={8} className="p-3" />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} className="m-3" />
          ) : query.data.items.length === 0 ? (
            <EmptyState
              className="m-3"
              title={filtered ? 'Eşleşen e-posta yok' : folder === 'INBOX' ? 'Gelen kutusu boş' : 'Henüz gönderilen e-posta yok'}
              description={filtered ? 'Filtreleri değiştirip tekrar deneyin.' : folder === 'INBOX' ? 'Yeni e-postalar 3 dakikada bir otomatik çekilir; beklemeden almak için “Yenile”.' : undefined}
              action={
                filtered ? (
                  <Button variant="outline" size="sm" onClick={() => set({ q: '', accountId: '', unread: '' })}>
                    Filtreleri temizle
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <ul className={cn('min-h-0 flex-1 divide-y overflow-y-auto transition-opacity', query.isPlaceholderData && 'opacity-60')}>
                {query.data.items.map((m) => (
                  <li key={m.id}>
                    <MessageRow m={m} folder={folder} active={m.id === selectedId} showAccount={!params.accountId && accounts.length > 1} onSelect={() => select(m.id)} />
                  </li>
                ))}
              </ul>
              <Pagination page={page} limit={limit} total={query.data.total} onPageChange={(p) => set({ page: p })} className="border-t px-3 py-2" />
            </>
          )}
        </section>

        <section aria-label="E-posta" className={cn('flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card', !selectedId && 'hidden lg:flex')}>
          {selectedId ? (
            <MessageReader id={selectedId} onBack={() => set({ id: '', page: keepPage })} onGone={() => set({ id: '', page: keepPage })} onCompose={setCompose} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
              <MailIcon className="size-6" />
              Okumak için bir e-posta seçin
            </div>
          )}
        </section>
      </div>

      {compose && <ComposeDialog request={compose} accounts={usable} onClose={() => setCompose(null)} />}
    </>
  );
}

function MailPageInner() {
  const accounts = useMailAccounts();
  if (accounts.isPending) return <LoadingBlock rows={8} />;
  if (accounts.isError) return <ErrorState error={accounts.error} onRetry={() => accounts.refetch()} />;
  if (accounts.data.length === 0)
    return (
      <>
        <PageHeader title="Gelen kutusu" />
        <NoAccounts />
      </>
    );
  return <Mailbox accounts={accounts.data} />;
}

export default function MailPage() {
  return (
    <Suspense fallback={null}>
      <MailPageInner />
    </Suspense>
  );
}
