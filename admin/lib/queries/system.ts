'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import type { AuditLog, Dashboard, Paginated, SettingKey, Settings } from '@/lib/types';

export const systemKeys = {
  dashboard: ['dashboard'] as const,
  settings: ['settings'] as const,
  audit: (p: { page: number; limit: number; q?: string }) => ['audit-logs', p] as const,
};

export const useDashboard = () => useQuery({ queryKey: systemKeys.dashboard, queryFn: () => api.get<Dashboard>('/admin/dashboard'), refetchInterval: 60_000 });

export const useSettings = () => useQuery({ queryKey: systemKeys.settings, queryFn: () => api.get<Settings>('/admin/settings') });
export const useSaveSetting = () =>
  useApiMutation<unknown, { key: SettingKey; value: Settings[SettingKey] }>({
    mutationFn: ({ key, value }) => api.put(`/admin/settings/${key}`, value),
    invalidate: [systemKeys.settings],
    success: 'Ayarlar kaydedildi',
  });

export const useAuditLogs = (params: { page: number; limit: number; q?: string }) =>
  useQuery({ queryKey: systemKeys.audit(params), queryFn: () => api.get<Paginated<AuditLog>>(`/admin/audit-logs${qs(params)}`), placeholderData: keepPreviousData });

export const useChangePassword = () =>
  useApiMutation<unknown, { currentPassword: string; newPassword: string }>({ mutationFn: (body) => api.post('/auth/change-password', body), success: 'Şifre değiştirildi' });
