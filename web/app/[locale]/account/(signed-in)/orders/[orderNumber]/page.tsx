import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { apiGet, ApiError } from '@/lib/api.server';
import type { Order } from '@/lib/types';
import { OrderDetail } from '@/components/order/order-detail';

export default async function OrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const locale = await getLocale();
  let order: Order;
  try {
    order = await apiGet<Order>(`/me/orders/${orderNumber}`, { auth: true, locale });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  return <OrderDetail order={order} />;
}
