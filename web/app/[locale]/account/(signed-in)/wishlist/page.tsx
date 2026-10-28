import { getLocale, getTranslations } from 'next-intl/server';
import { apiGet } from '@/lib/api.server';
import type { ProductCard as Card } from '@/lib/types';
import { ProductGrid } from '@/components/product/product-grid';

export default async function WishlistPage() {
  const locale = await getLocale();
  const t = await getTranslations('account');
  const items = await apiGet<{ product: Card }[]>('/me/wishlist', { auth: true, locale }).catch(() => []);
  if (!items.length) return <p className="text-muted">{t('noWishlist')}</p>;
  return <ProductGrid products={items.map((i) => i.product)} columns={3} />;
}
