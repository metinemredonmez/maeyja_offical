'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import type { ContactMessage, Paginated, PushCampaign, PushListResponse, PushTarget, Subscriber } from '@/lib/types';

export const marketingKeys = {
  newsletter: ['newsletter'] as const,
  newsletterList: (p: { page: number; limit: number; q?: string }) => ['newsletter', 'list', p] as const,
  messages: ['messages'] as const,
  messageList: (p: { page: number; limit: number }) => ['messages', 'list', p] as const,
  push: ['push'] as const,
  pushList: (p: { page: number; limit: number }) => ['push', 'list', p] as const,
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
    success: (c) => (c.status === 'SENT' ? `Gönderildi (${c.recipients ?? 0} alıcı)` : `Gönderilemedi: ${c.error ?? 'bilinmeyen hata'}`),
  });
