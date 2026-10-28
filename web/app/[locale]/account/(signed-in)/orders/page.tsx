import Image from 'next/image';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { apiGet } from '@/lib/api.server';
import { formatDate, money } from '@/lib/format';
import type { OrderSummary, Paginated } from '@/lib/types';

export default async function OrdersPage() {
  const locale = await getLocale();
  const t = await getTranslations('account');
  const to = await getTranslations('order');
  const list = await apiGet<Paginated<OrderSummary>>('/me/orders?limit=50', { auth: true, locale }).catch(() => null);
  const orders = list?.items ?? [];
  if (!orders.length) return <p className="text-muted">{t('noOrders')}</p>;
  return (
    <ul className="divide-y divide-line">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/account/orders/${o.orderNumber}`} className="flex items-center gap-5 py-5 hover:text-brand">
            <div className="ph relative aspect-[4/5] w-14 shrink-0">{o.items[0]?.imageUrl ? <Image src={o.items[0].imageUrl} alt="" fill sizes="56px" className="object-cover" /> : null}</div>
            <div className="flex flex-1 flex-col gap-1 text-sm">
              <span className="flex justify-between"><span>{o.orderNumber}</span><span>{money(o.total, locale)}</span></span>
              <span className="flex justify-between text-xs text-muted"><span>{formatDate(o.createdAt, locale)}</span><span>{to(`statuses.${o.status}`)}</span></span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
