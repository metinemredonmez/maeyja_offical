'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { api } from '@/lib/api.client';
import type { Cart } from '@/lib/types';

const KEY = ['cart'];

/** One cart query shared by the header badge, drawer, cart page and checkout. */
export function useCart() {
  const locale = useLocale();
  return useQuery({ queryKey: KEY, queryFn: () => api.get<Cart>('/cart', locale) });
}

export function useCartMutations() {
  const qc = useQueryClient();
  const locale = useLocale();
  const set = (cart: Cart) => qc.setQueryData(KEY, cart);

  const add = useMutation({
    mutationFn: (input: { variantId: string; quantity: number }) => api.post<Cart>('/cart/items', input, locale),
    onSuccess: set,
  });
  const setQuantity = useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: string; quantity: number }) => api.patch<Cart>(`/cart/items/${variantId}`, { quantity }, locale),
    onSuccess: set,
  });
  const remove = useMutation({
    mutationFn: (variantId: string) => api.delete<Cart>(`/cart/items/${variantId}`, locale),
    onSuccess: set,
  });
  const applyCoupon = useMutation({
    mutationFn: (code: string) => api.post<Cart>('/cart/coupon', { code }, locale),
    onSuccess: set,
  });
  const removeCoupon = useMutation({
    mutationFn: () => api.delete<Cart>('/cart/coupon', locale),
    onSuccess: set,
  });
  return { add, setQuantity, remove, applyCoupon, removeCoupon, invalidate: () => qc.invalidateQueries({ queryKey: KEY }) };
}
