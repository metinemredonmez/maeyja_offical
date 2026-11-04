'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, qs } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import type { Alert, AlertCatalogItem, AlertLevel, AlertTestResult, Paginated } from '@/lib/types';

export type AlertListParams = { page: number; limit: number; status?: 'open' | 'resolved' | 'all'; level?: AlertLevel; q?: string };

export const alertKeys = {
  all: ['alerts'] as const,
  list: (p: AlertListParams) => ['alerts', 'list', p] as const,
  summary: ['alerts', 'summary'] as const,
  catalog: ['alerts', 'catalog'] as const,
};

export const useAlerts = (params: AlertListParams) =>
  useQuery({ queryKey: alertKeys.list(params), queryFn: () => api.get<Paginated<Alert>>(`/admin/alerts${qs(params)}`), placeholderData: keepPreviousData, refetchInterval: 60_000 });

/** The top bar's badge; only asked for roles that may read alerts. */
export const useAlertSummary = (enabled: boolean) =>
  useQuery({ queryKey: alertKeys.summary, queryFn: () => api.get<{ open: number; critical: number }>('/admin/alerts/summary'), enabled, refetchInterval: 60_000, retry: false });

export const useAlertCatalog = () => useQuery({ queryKey: alertKeys.catalog, queryFn: () => api.get<AlertCatalogItem[]>('/admin/alerts/catalog'), staleTime: Infinity });

export const useResolveAlert = () =>
  useApiMutation<Alert, string>({ mutationFn: (id) => api.patch<Alert>(`/admin/alerts/${id}/resolve`), invalidate: [alertKeys.all], success: 'Çözüldü olarak işaretlendi' });

export const useResolveAllAlerts = () =>
  useApiMutation<{ resolved: number }>({
    mutationFn: () => api.post<{ resolved: number }>('/admin/alerts/resolve-all'),
    invalidate: [alertKeys.all],
    success: (r) => `${r.resolved} uyarı çözüldü olarak işaretlendi`,
  });

/** Sends a test alert through both channels and says how each went. */
export const useTestAlerts = () =>
  useApiMutation<AlertTestResult>({
    mutationFn: () => api.post<AlertTestResult>('/admin/alerts/test'),
    success: false,
    onSuccess: (r) => {
      if (!r.smtp) toast.warning('SMTP ayarlı değil: e-posta gönderilemiyor. Sunucuda SMTP_* ayarlanmalı.');
      else if (!r.emailTo) toast.warning('Alıcı e-posta yok: Ayarlar → Uyarılar’dan bir adres girin.');
      else if (r.email) toast.success(`Deneme e-postası gönderildi (${r.emailTo})`);
      else toast.error(`E-posta gönderilemedi (${r.emailTo}); SMTP ayarlarını kontrol edin.`);
      if (r.webhook === true) toast.success('Webhook mesajı gönderildi');
      if (r.webhook === false) toast.error('Webhook mesajı gönderilemedi; adresi kontrol edin.');
    },
  });
