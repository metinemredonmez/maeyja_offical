'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MailDisabledNotice } from '@/components/marketing/campaign-form';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime } from '@/components/shared/primitives';
import { ToneBadge } from '@/components/shared/status-badge';
import { useListParams } from '@/hooks/use-list-params';
import { LOCALE_LABELS, type Locale } from '@/lib/i18n';
import { CAMPAIGN_AUDIENCE, CAMPAIGN_STATUS } from '@/lib/labels';
import { useCampaigns } from '@/lib/queries/marketing';
import type { EmailCampaign } from '@/lib/types';

function CampaignsList() {
  const { params, set, page, limit } = useListParams({ q: '' });
  const query = useCampaigns({ page, limit, q: params.q || undefined });

  const columns: Column<EmailCampaign>[] = [
    {
      key: 'subject',
      header: 'Konu',
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{c.subject}</p>
          <p className="text-xs text-muted-foreground">
            <DateTime value={c.createdAt} mode="date" />
          </p>
        </div>
      ),
    },
    {
      key: 'audience',
      header: 'Hedef',
      cell: (c) => (
        <span className="text-xs text-muted-foreground">
          {CAMPAIGN_AUDIENCE[c.audience]} · {c.locale ? LOCALE_LABELS[c.locale as Locale] ?? c.locale : 'Tüm diller'}
        </span>
      ),
    },
    { key: 'status', header: 'Durum', cell: (c) => <ToneBadge tone={CAMPAIGN_STATUS[c.status].tone}>{CAMPAIGN_STATUS[c.status].label}</ToneBadge> },
    {
      key: 'progress',
      header: 'Gönderilen',
      align: 'right',
      cell: (c) =>
        c.status === 'DRAFT' ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="tabular-nums">
            {c.sentCount} / {c.totalRecipients}
            {c.failedCount > 0 && <span className="ml-1 text-[#A3121B]">({c.failedCount} hata)</span>}
          </span>
        ),
    },
    { key: 'startedAt', header: 'Gönderim', cell: (c) => (c.startedAt ? <DateTime value={c.startedAt} /> : <span className="text-muted-foreground">—</span>) },
  ];

  return (
    <>
      <PageHeader
        title="E-posta kampanyaları"
        description="Bülten abonelerine ve pazarlama izni vermiş müşterilere toplu e-posta"
        actions={
          <Button render={<Link href="/campaigns/new" />}>
            <PlusIcon /> Yeni kampanya
          </Button>
        }
      />
      {query.data && !query.data.mailEnabled && <MailDisabledNotice />}
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(c) => c.id}
        rowHref={(c) => `/campaigns/${c.id}`}
        total={query.data?.total}
        page={page}
        limit={limit}
        onPageChange={(p) => set({ page: p })}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        emptyTitle="Henüz kampanya yok"
        search={{ value: params.q, onChange: (q) => set({ q }), placeholder: 'Konu ara…' }}
      />
    </>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={null}>
      <CampaignsList />
    </Suspense>
  );
}
