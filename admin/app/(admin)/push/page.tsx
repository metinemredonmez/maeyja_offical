'use client';

import { Suspense } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangleIcon, SendIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Field, FormError, SimpleSelect, SubmitButton } from '@/components/shared/form';
import { ImageUrlField } from '@/components/shared/media-picker';
import { PageHeader } from '@/components/shared/page-header';
import { UserPicker } from '@/components/shared/pickers';
import { DateTime, Section } from '@/components/shared/primitives';
import { StatusBadge, ToneBadge } from '@/components/shared/status-badge';
import { useListParams } from '@/hooks/use-list-params';
import { usePushCampaigns, useSendPush } from '@/lib/queries/marketing';
import { pushSchema, type PushFormValues } from '@/lib/schemas/content';
import type { PushCampaign } from '@/lib/types';

const PLATFORM: Record<string, string> = { IOS: 'iOS', ANDROID: 'Android', WEB: 'Web' };

function PushForm({ disabled }: { disabled: boolean }) {
  const send = useSendPush();
  const form = useForm<PushFormValues>({ resolver: zodResolver(pushSchema), defaultValues: { title: '', body: '', url: '', imageUrl: '', target: 'ALL', userIds: [] } });
  const target = form.watch('target');
  const onSubmit = form.handleSubmit(async (raw) => {
    const v = pushSchema.parse(raw);
    await send.mutateAsync({ title: v.title, body: v.body, url: v.url, imageUrl: v.imageUrl, target: v.target, userIds: v.target === 'USERS' ? v.userIds : undefined });
    form.reset();
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormError error={send.error} />
      <Field label="Başlık" error={form.formState.errors.title} htmlFor="title" required hint={`${form.watch('title').length}/80`}>
        <Input id="title" maxLength={80} disabled={disabled} {...form.register('title')} />
      </Field>
      <Field label="Metin" error={form.formState.errors.body} htmlFor="body" required hint={`${form.watch('body').length}/240`}>
        <Textarea id="body" rows={3} maxLength={240} disabled={disabled} {...form.register('body')} />
      </Field>
      <Field label="Açılacak adres" error={form.formState.errors.url} htmlFor="url" hint="Derin bağlantı veya web adresi (opsiyonel)">
        <Input id="url" maxLength={500} placeholder="https://maeyja.com/collections/…" disabled={disabled} {...form.register('url')} />
      </Field>
      <Field label="Görsel (opsiyonel)" error={form.formState.errors.imageUrl}>
        <Controller control={form.control} name="imageUrl" render={({ field }) => <ImageUrlField value={field.value} onChange={field.onChange} />} />
      </Field>
      <Field label="Hedef" htmlFor="target" required>
        <Controller
          control={form.control}
          name="target"
          render={({ field }) => (
            <SimpleSelect
              id="target"
              value={field.value}
              onChange={field.onChange}
              disabled={disabled}
              options={[
                { value: 'ALL', label: 'Tüm aboneler' },
                { value: 'USERS', label: 'Seçili kullanıcılar' },
              ]}
            />
          )}
        />
      </Field>
      {target === 'USERS' && (
        <Field label="Kullanıcılar" error={form.formState.errors.userIds as { message?: string } | undefined} required>
          <Controller control={form.control} name="userIds" render={({ field }) => <UserPicker value={field.value} onChange={field.onChange} />} />
        </Field>
      )}
      <SubmitButton loading={send.isPending} disabled={disabled} className="justify-self-start">
        <SendIcon /> Gönder
      </SubmitButton>
    </form>
  );
}

function PushPageInner() {
  const { set, page, limit } = useListParams({});
  const query = usePushCampaigns({ page, limit });
  const providerEnabled = query.data?.providerEnabled ?? true;
  // OneSignal rejects a send with no subscribed device, so wait for the first app install.
  const deviceCount = query.data?.devices.reduce((n, d) => n + d._count, 0) ?? 0;
  const noDevices = Boolean(query.data) && deviceCount === 0;
  const columns: Column<PushCampaign>[] = [
    {
      key: 'title',
      header: 'Kampanya',
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{c.title}</p>
          <p className="truncate text-xs text-muted-foreground">{c.body}</p>
        </div>
      ),
    },
    { key: 'target', header: 'Hedef', cell: (c) => <ToneBadge tone="neutral">{c.target === 'ALL' ? 'Tümü' : `${c.targetUserIds.length} kullanıcı`}</ToneBadge> },
    {
      key: 'status',
      header: 'Durum',
      cell: (c) => (
        <div>
          <StatusBadge kind="push" value={c.status} />
          {c.error && <p className="mt-0.5 max-w-xs truncate text-[11px] text-rose-700">{c.error}</p>}
        </div>
      ),
    },
    { key: 'recipients', header: 'Alıcı', align: 'right', cell: (c) => <span className="tabular-nums">{c.recipients ?? '—'}</span> },
    { key: 'date', header: 'Tarih', align: 'right', cell: (c) => <DateTime value={c.sentAt ?? c.createdAt} className="text-xs text-muted-foreground" /> },
  ];

  return (
    <>
      <PageHeader title="Push bildirim" description="OneSignal üzerinden mobil uygulama kullanıcılarına bildirim gönderin." />
      {!providerEnabled && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">OneSignal yapılandırılmamış</p>
            <p className="text-xs">Sunucuda ONESIGNAL_APP_ID ve ONESIGNAL_API_KEY tanımlanana kadar gönderim yapılamaz.</p>
          </div>
        </div>
      )}
      {providerEnabled && noDevices && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Henüz bildirim alacak cihaz yok</p>
            <p className="text-xs">Bildirimler mobil uygulamayı yükleyip izin veren kullanıcılara gider. Uygulama yayınlanıp ilk cihaz kaydolunca gönderim açılır.</p>
          </div>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <Section title="Yeni bildirim">
            <PushForm disabled={!providerEnabled || noDevices} />
          </Section>
          <Section title="Aktif cihazlar">
            {query.data?.devices.length ? (
              <ul className="flex gap-4 text-sm">
                {query.data.devices.map((d) => (
                  <li key={d.platform}>
                    <span className="text-2xl font-semibold tabular-nums">{d._count}</span> <span className="text-xs text-muted-foreground">{PLATFORM[d.platform] ?? d.platform}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Kayıtlı cihaz yok.</p>
            )}
          </Section>
        </div>
        <Section title="Gönderim geçmişi">
          <DataTable columns={columns} rows={query.data?.items} rowKey={(c) => c.id} total={query.data?.total} page={page} limit={limit} onPageChange={(p) => set({ page: p })} isLoading={query.isPending} isFetching={query.isFetching} error={query.error} onRetry={() => query.refetch()} emptyTitle="Henüz gönderim yok" />
        </Section>
      </div>
    </>
  );
}

export default function PushPage() {
  return (
    <Suspense fallback={null}>
      <PushPageInner />
    </Suspense>
  );
}
