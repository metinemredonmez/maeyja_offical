'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import type { Coupon, OrderDetail, OrderListResponse, OrderStatus, Paginated, PaymentProvider, ReturnRequest, ReturnStatus } from '@/lib/types';

export const orderKeys = {
  all: ['orders'] as const,
  list: (p: OrderListParams) => ['orders', 'list', p] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
  returns: ['returns'] as const,
  returnList: (p: { page: number; limit: number; status?: ReturnStatus | '' }) => ['returns', 'list', p] as const,
  coupons: ['coupons'] as const,
  couponList: (p: { page: number; limit: number; q?: string }) => ['coupons', 'list', p] as const,
  coupon: (id: string) => ['coupons', 'detail', id] as const,
};

export type OrderListParams = { page: number; limit: number; q?: string; status?: OrderStatus | ''; provider?: PaymentProvider | ''; from?: string; to?: string };

export function useOrders(params: OrderListParams, enabled = true) {
  return useQuery({ queryKey: orderKeys.list(params), queryFn: () => api.get<OrderListResponse>(`/admin/orders${qs(params)}`), placeholderData: keepPreviousData, enabled });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: orderKeys.detail(id), queryFn: () => api.get<OrderDetail>(`/admin/orders/${id}`) });
}

export type StatusChangeInput = { status: OrderStatus; note?: string; restock?: boolean; refundOnProvider?: boolean; notifyCustomer?: boolean };
export const useUpdateOrderStatus = (id: string) =>
  useApiMutation<OrderDetail, StatusChangeInput>({
    mutationFn: (body) => api.patch(`/admin/orders/${id}/status`, body),
    invalidate: [orderKeys.all, ['dashboard']],
    success: 'Sipariş durumu güncellendi',
  });

export type ShipInput = { carrier: string; trackingNumber: string; trackingUrl?: string; notifyCustomer?: boolean };
export const useShipOrder = (id: string) =>
  useApiMutation<OrderDetail, ShipInput>({ mutationFn: (body) => api.post(`/admin/orders/${id}/ship`, body), invalidate: [orderKeys.all, ['dashboard']], success: 'Kargo bilgisi kaydedildi' });

export const useOrderNote = (id: string) =>
  useApiMutation<OrderDetail, string>({ mutationFn: (adminNote) => api.patch(`/admin/orders/${id}/note`, { adminNote }), invalidate: [orderKeys.detail(id)], success: 'Not kaydedildi' });

// ───────────── returns ─────────────
export function useReturns(params: { page: number; limit: number; status?: ReturnStatus | '' }) {
  return useQuery({ queryKey: orderKeys.returnList(params), queryFn: () => api.get<Paginated<ReturnRequest>>(`/admin/returns${qs(params)}`), placeholderData: keepPreviousData });
}
export const useUpdateReturn = () =>
  useApiMutation<ReturnRequest, { id: string; status: ReturnStatus; adminNote?: string }>({
    mutationFn: ({ id, ...body }) => api.patch(`/admin/returns/${id}`, body),
    invalidate: [orderKeys.returns, orderKeys.all, ['dashboard']],
    success: 'İade talebi güncellendi',
  });

// ───────────── coupons ─────────────
export function useCoupons(params: { page: number; limit: number; q?: string }) {
  return useQuery({ queryKey: orderKeys.couponList(params), queryFn: () => api.get<Paginated<Coupon>>(`/admin/coupons${qs(params)}`), placeholderData: keepPreviousData });
}
export function useCoupon(id: string | undefined) {
  return useQuery({ queryKey: orderKeys.coupon(id ?? ''), queryFn: () => api.get<Coupon>(`/admin/coupons/${id}`), enabled: Boolean(id) });
}
export type CouponInput = Partial<Omit<Coupon, 'id' | 'usedCount' | 'createdAt' | 'redemptions'>> & { code: string; type: Coupon['type']; value: number };
export const useSaveCoupon = () =>
  useApiMutation<Coupon, { id?: string; body: CouponInput }>({
    mutationFn: ({ id, body }) => (id ? api.patch(`/admin/coupons/${id}`, body) : api.post('/admin/coupons', body)),
    invalidate: [orderKeys.coupons],
  });
export const useDeleteCoupon = () =>
  useApiMutation<{ ok: true; deactivated?: boolean }, string>({
    mutationFn: (id) => api.delete(`/admin/coupons/${id}`),
    invalidate: [orderKeys.coupons],
    success: (r) => (r.deactivated ? 'Kupon kullanılmış; pasife alındı' : 'Kupon silindi'),
  });
