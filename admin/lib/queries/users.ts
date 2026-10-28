'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import type { AdminUserDetail, AdminUserRow, AuthUser, Paginated, UserRole } from '@/lib/types';

export const userKeys = {
  all: ['users'] as const,
  list: (p: UserListParams) => ['users', 'list', p] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
};

export type UserListParams = { page: number; limit: number; q?: string; role?: UserRole | '' };

export function useUsers(params: UserListParams, enabled = true) {
  return useQuery({ queryKey: userKeys.list(params), queryFn: () => api.get<Paginated<AdminUserRow>>(`/admin/users${qs(params)}`), placeholderData: keepPreviousData, enabled });
}

export function useUser(id: string) {
  return useQuery({ queryKey: userKeys.detail(id), queryFn: () => api.get<AdminUserDetail>(`/admin/users/${id}`) });
}

export type UserUpdateInput = { role?: UserRole; isActive?: boolean; firstName?: string; lastName?: string; phone?: string };
export const useUpdateUser = () =>
  useApiMutation<AuthUser & { isActive: boolean }, { id: string; body: UserUpdateInput }>({
    mutationFn: ({ id, body }) => api.patch(`/admin/users/${id}`, body),
    invalidate: [userKeys.all],
    success: 'Kullanıcı güncellendi',
  });

export type CreateStaffInput = { email: string; password: string; firstName: string; lastName: string; role: UserRole };
export const useCreateStaff = () =>
  useApiMutation<AuthUser, CreateStaffInput>({ mutationFn: (body) => api.post('/admin/users', body), invalidate: [userKeys.all], success: 'Personel oluşturuldu' });
