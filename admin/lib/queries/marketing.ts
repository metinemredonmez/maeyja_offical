'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, qs } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import type { CampaignAudience, ContactMessage, EmailCampaign, EmailCampaignDetail, Paginated, PushCampaign, PushListResponse, PushTarget, Subscriber } from '@/lib/types';

export const marketingKeys = {
  newsletter: ['newsletter'] as const,
  newsletterList: (p: { page: number; limit: number; q?: string }) => ['newsletter', 'list', p] as const,
  messages: ['messages'] as const,
  messageList: (p: { page: number; limit: number }) => ['messages', 'list', p] as const,
  push: ['push'] as const,
  pushList: (p: { page: number; limit: number }) => ['push', 'list', p] as const,
  campaigns: ['campaigns'] as const,
  campaignList: (p: { page: number; limit: number; q?: string }) => ['campaigns', 'list', p] as const,
  campaign: (id: string) => ['campaigns', 'detail', id] as const,
  audience: (p: { audience: CampaignAudience; locale: string | null }) => ['campaigns', 'audience', p] as const,
};

export const useSubscribers = (params: { page: number; limit: number; q?: string }) =>
  useQuery({ queryKey: marketingKeys.newsletterList(params), queryFn: () => api.get<Paginated<Subscriber>>(`/admin/newsletter${qs(params)}`), placeholderData: keepPreviousData });
export const useDeleteSubscriber = () =>
  useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/newsletter/${id}`), invalidate: [marketingKeys.newsletter, ['dashboard']], success: 'Abone silindi' });

export const useMessages = (params: { page: number; limit: number }) =>
  useQuery({
    queryKey: marketingKeys.messageList(params),
    queryFn: () => api.get<Paginated<ContactMessage> & { unread: number }>(`/admin/messages${qs(params)}`),
    placeholderData: keepPreviousData,
  });
export const useMarkMessage = () =>
  useApiMutation<ContactMessage, { id: string; isRead: boolean }>({
    mutationFn: ({ id, isRead }) => api.patch(`/admin/messages/${id}`, { isRead }),
    invalidate: [marketingKeys.messages, ['dashboard']],
    success: false,
  });
export const useDeleteMessage = () =>
  useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/messages/${id}`), invalidate: [marketingKeys.messages, ['dashboard']], success: 'Mesaj silindi' });

export const usePushCampaigns = (params: { page: number; limit: number }) =>
  useQuery({ queryKey: marketingKeys.pushList(params), queryFn: () => api.get<PushListResponse>(`/admin/push${qs(params)}`), placeholderData: keepPreviousData });

export type SendPushInput = { title: string; body: string; url?: string; imageUrl?: string; target: PushTarget; userIds?: string[] };
export const useSendPush = () =>
  useApiMutation<PushCampaign, SendPushInput>({
    mutationFn: (body) => api.post('/admin/push', body),
    invalidate: [marketingKeys.push],
    // A rejected send still comes back 200 with status FAILED — show it as an error, not a success.
    success: false,
    onSuccess: (c) => {
      if (c.status === 'SENT') toast.success(`Gönderildi (${c.recipients ?? 0} alıcı)`);
      else toast.error(`Gönderilemedi: ${c.error ?? 'bilinmeyen hata'}`);
    },
  });

// ───────────── E-mail campaigns ─────────────
export type CampaignInput = {
  subject: string;
  preheader: string | null;
  title: string | null;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  audience: CampaignAudience;
  locale: string | null;
};

export const useCampaigns = (params: { page: number; limit: number; q?: string }) =>
  useQuery({
    queryKey: marketingKeys.campaignList(params),
    queryFn: () => api.get<Paginated<EmailCampaign> & { mailEnabled: boolean }>(`/admin/campaigns${qs(params)}`),
    placeholderData: keepPreviousData,
  });

/** Polls every 3 s while the campaign is being sent so the progress bar moves. */
export const useCampaign = (id: string) =>
  useQuery({
    queryKey: marketingKeys.campaign(id),
    queryFn: () => api.get<EmailCampaignDetail>(`/admin/campaigns/${id}`),
    refetchInterval: (q) => (q.state.data?.status === 'SENDING' ? 3000 : false),
  });

export const useCampaignAudience = (p: { audience: CampaignAudience; locale: string | null }) =>
  useQuery({
    queryKey: marketingKeys.audience(p),
    queryFn: () => api.get<{ count: number; mailEnabled: boolean }>(`/admin/campaigns/audience${qs({ audience: p.audience, locale: p.locale })}`),
    placeholderData: keepPreviousData,
  });

export const useCreateCampaign = () =>
  useApiMutation<EmailCampaign, CampaignInput>({ mutationFn: (body) => api.post('/admin/campaigns', body), invalidate: [marketingKeys.campaigns], success: 'Taslak kaydedildi' });
export const useUpdateCampaign = () =>
  useApiMutation<EmailCampaign, { id: string; body: Partial<CampaignInput> }>({
    mutationFn: ({ id, body }) => api.patch(`/admin/campaigns/${id}`, body),
    invalidate: [marketingKeys.campaigns],
    success: 'Kaydedildi',
  });
export const useDeleteCampaign = () =>
  useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/campaigns/${id}`), invalidate: [marketingKeys.campaigns], success: 'Kampanya silindi' });
export const useTestCampaign = () =>
  useApiMutation<{ ok: true; to: string }, { id: string; email?: string }>({
    mutationFn: ({ id, email }) => api.post(`/admin/campaigns/${id}/test`, { email }),
    success: (r) => `Test e-postası gönderildi: ${r.to}`,
  });
export const useSendCampaign = () =>
  useApiMutation<EmailCampaignDetail, string>({
    mutationFn: (id) => api.post(`/admin/campaigns/${id}/send`),
    invalidate: [marketingKeys.campaigns],
    success: (c) => `Gönderim başladı (${c.totalRecipients} alıcı)`,
  });
export const useCancelCampaign = () =>
  useApiMutation<EmailCampaignDetail, string>({ mutationFn: (id) => api.post(`/admin/campaigns/${id}/cancel`), invalidate: [marketingKeys.campaigns], success: 'Gönderim durduruldu' });
