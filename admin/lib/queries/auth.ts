'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hardNavigate } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import type { AuthUser, MfaSetup, MfaStatus } from '@/lib/types';

export const authKeys = { me: ['auth', 'me'] as const, mfa: ['auth', 'mfa'] as const };

export function useMe(initialData?: AuthUser | null) {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => api.get<AuthUser>('/auth/me'),
    initialData: initialData ?? undefined,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return async () => {
    await api.post('/auth/logout').catch(() => null);
    qc.clear();
    hardNavigate('/login');
  };
}

// ───────────── TOTP two-factor ─────────────
export const useMfaStatus = () => useQuery({ queryKey: authKeys.mfa, queryFn: () => api.get<MfaStatus>('/auth/mfa'), retry: false });

export const useMfaSetup = () => useApiMutation<MfaSetup, void>({ mutationFn: () => api.post('/auth/mfa/setup'), success: false });

export const useMfaEnable = () =>
  useApiMutation<{ backupCodes: string[] }, { code: string }>({
    mutationFn: (body) => api.post('/auth/mfa/enable', body),
    invalidate: [authKeys.mfa, authKeys.me],
    success: 'İki adımlı doğrulama açıldı',
  });

export const useMfaDisable = () =>
  useApiMutation<{ ok: true }, { password: string; code: string }>({
    mutationFn: (body) => api.post('/auth/mfa/disable', body),
    invalidate: [authKeys.mfa, authKeys.me],
    success: 'İki adımlı doğrulama kapatıldı',
  });

export const useMfaBackupCodes = () =>
  useApiMutation<{ backupCodes: string[] }, { code: string }>({
    mutationFn: (body) => api.post('/auth/mfa/backup-codes', body),
    invalidate: [authKeys.mfa],
    success: 'Yedek kodlar yenilendi — eski kodlar artık geçersiz',
  });
