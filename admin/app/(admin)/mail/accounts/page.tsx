'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CircleCheckIcon, CircleXIcon, Loader2Icon, PencilIcon, PlugZapIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MailAccountDialog } from '@/components/mail/account-dialog';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime } from '@/components/shared/primitives';
import { ToneBadge } from '@/components/shared/status-badge';
import { useDeleteMailAccount, useMailAccounts, useSetDefaultMailAccount, useTestMailAccount } from '@/lib/queries/mail';
import type { MailAccount, MailTestResult } from '@/lib/types';
import { cn } from '@/lib/utils';

function ProtocolResult({ label, r }: { label: string; r: MailTestResult['imap'] }) {
  return (
    <span className={cn('inline-flex items-center gap-1', r.ok ? 'text-emerald-700' : 'text-rose-700')}>
      {r.ok ? <CircleCheckIcon className="size-3.5" /> : <CircleXIcon className="size-3.5" />} {label}
    </span>
  );
}

function ConnectionStatus({ a, result }: { a: MailAccount; result?: MailTestResult }) {
  const tone = a.lastTestOk === null ? 'muted' : a.lastTestOk ? 'success' : 'danger';
  return (
    <div className="max-w-72 space-y-1 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <ToneBadge tone={tone} dot>
          {a.lastTestOk === null ? 'Test edilmedi' : a.lastTestOk ? 'Bağlantı başarılı' : 'Bağlantı hatası'}
        </ToneBadge>
        {a.lastTestAt && <DateTime value={a.lastTestAt} mode="relative" className="text-muted-foreground" />}
      </div>
      {result && (
        <p className="flex gap-3">
          <ProtocolResult label="IMAP" r={result.imap} />
          <ProtocolResult label="SMTP" r={result.smtp} />
        </p>
      )}
      {a.lastError && <p className="line-clamp-3 break-words text-rose-700">{a.lastError}</p>}
    </div>
  );
}

export default function MailAccountsPage() {
  const query = useMailAccounts();
  const test = useTestMailAccount();
  const setDefault = useSetDefaultMailAccount();
  const del = useDeleteMailAccount();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<MailAccount | 'new' | null>(null);
  const [results, setResults] = useState<Record<string, MailTestResult>>({});

  const runTest = (a: MailAccount) =>
    test.mutate(a.id, {
      onSuccess: (r) => {
        setResults((prev) => ({ ...prev, [a.id]: r }));
        if (r.imap.ok && r.smtp.ok) toast.success('Bağlantı başarılı', { description: `${a.email}: IMAP ve SMTP çalışıyor` });
        else
          toast.error('Bağlantı testi başarısız', {
            description: [!r.imap.ok && `IMAP: ${r.imap.error ?? 'bağlanılamadı'}`, !r.smtp.ok && `SMTP: ${r.smtp.error ?? 'bağlanılamadı'}`].filter(Boolean).join('\n'),
          });
      },
    });

  const columns: Column<MailAccount>[] = [
    {
      key: 'account',
      header: 'Hesap',
      cell: (a) => (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 font-medium">
            <span className="truncate">{a.email}</span>
            {a.isDefault && <ToneBadge tone="info">Varsayılan</ToneBadge>}
            {!a.isActive && <ToneBadge tone="muted">Pasif</ToneBadge>}
          </p>
          <p className="text-xs text-muted-foreground">
            {a.fromName || '—'}
            {a.unreadCount > 0 && ` · ${a.unreadCount} okunmamış`}
          </p>
        </div>
      ),
    },
    {
      key: 'servers',
      header: 'Sunucular',
      cell: (a) => (
        <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
          <p>
            IMAP {a.imapHost}:{a.imapPort}
            {a.imapSecure && ' · TLS'}
          </p>
          <p>
            SMTP {a.smtpHost}:{a.smtpPort}
            {a.smtpSecure && ' · TLS'}
          </p>
          {a.allowSelfSigned && <p className="font-sans">kendinden imzalı sertifika kabul</p>}
        </div>
      ),
    },
    { key: 'fetch', header: 'Son çekme', cell: (a) => <DateTime value={a.lastFetchAt} mode="relative" className="text-xs text-muted-foreground" /> },
    { key: 'status', header: 'Bağlantı', cell: (a) => <ConnectionStatus a={a} result={results[a.id]} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (a) => {
        const testing = test.isPending && test.variables === a.id;
        return (
          <div className="flex justify-end gap-1">
            <Button variant="outline" size="sm" disabled={test.isPending} onClick={() => runTest(a)}>
              {testing ? <Loader2Icon className="animate-spin" /> : <PlugZapIcon />} Test et
            </Button>
            {!a.isDefault && a.isActive && (
              <Button variant="ghost" size="sm" disabled={setDefault.isPending} onClick={() => setDefault.mutate(a.id)}>
                <StarIcon /> Varsayılan yap
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(a)} aria-label="Düzenle">
              <PencilIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-[#A3121B]"
              aria-label="Sil"
              onClick={() =>
                confirm.ask({
                  title: `${a.email} silinsin mi?`,
                  description: 'Hesap ve panelde saklanan tüm e-postaları (ekleriyle birlikte) kalıcı olarak silinir. Posta sunucusundaki e-postalara dokunulmaz; hesabı yeniden eklerseniz tekrar çekilir.',
                  confirmLabel: 'Hesabı sil',
                  destructive: true,
                  onConfirm: () => del.mutateAsync(a.id),
                })
              }
            >
              <Trash2Icon />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="E-posta hesapları"
        description="Gelen kutusunun okuduğu ve gönderim yaptığı IMAP/SMTP hesapları. Yeni e-postalar 3 dakikada bir çekilir."
        backHref="/mail"
        backLabel="Gelen kutusu"
        actions={
          <Button onClick={() => setEditing('new')}>
            <PlusIcon /> Yeni hesap
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={query.data}
        rowKey={(a) => a.id}
        isLoading={query.isPending}
        error={query.error}
        onRetry={() => query.refetch()}
        emptyTitle="Henüz hesap yok"
        emptyDescription="Bu sunucudaki bir posta kutusunu ya da bir Gmail hesabını ekleyin."
        emptyAction={
          <Button size="sm" onClick={() => setEditing('new')}>
            <PlusIcon /> Hesap ekle
          </Button>
        }
      />
      {editing && <MailAccountDialog account={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {confirm.dialog}
    </>
  );
}
