import type { ProductCard as Card } from '@/lib/types';
import { ProductCard } from './product-card';

export function ProductGrid({ products, columns = 3 }: { products: Card[]; columns?: 2 | 3 | 4 }) {
  const cols = columns === 4 ? 'lg:grid-cols-4' : columns === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3';
  return (
    <div className={`grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 ${cols}`}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 3} />
      ))}
    </div>
  );
}
