'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { CartUiProvider } from '@/components/cart/cart-ui';

export function Providers({ children }: { children: ReactNode; nonce?: string }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <CartUiProvider>{children}</CartUiProvider>
    </QueryClientProvider>
  );
}
