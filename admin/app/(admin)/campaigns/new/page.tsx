'use client';

import { useRouter } from 'next/navigation';
import { CampaignForm } from '@/components/marketing/campaign-form';
import { PageHeader } from '@/components/shared/page-header';
import { useCreateCampaign } from '@/lib/queries/marketing';

export default function NewCampaignPage() {
  const router = useRouter();
  const create = useCreateCampaign();
  return (
    <>
      <PageHeader title="Yeni kampanya" description="Önce taslak kaydedilir; test e-postası ve gönderim sonraki adımda." backHref="/campaigns" backLabel="Kampanyalar" />
      <CampaignForm
        onSubmit={async (body) => {
          const c = await create.mutateAsync(body);
          router.replace(`/campaigns/${c.id}`);
        }}
        submitting={create.isPending}
        error={create.error}
      />
    </>
  );
}
