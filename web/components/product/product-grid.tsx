import type { ProductCard as Card } from '@/lib/types';
import { ProductCard } from './product-card';

/** BOYY rows: no gap between tiles, so each row reads as one grey band. */
export function ProductGrid({ products, columns = 4 }: { products: Card[]; columns?: 2 | 3 | 4 }) {
  const cols = columns === 4 ? 'lg:grid-cols-4' : columns === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3';
  return (
    <div className={`grid grid-cols-2 gap-y-12 md:gap-y-16 ${cols}`}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
