'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/lib/api.client';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PaletteProvider } from '@/components/layout/palette-picker';
import type { PaletteId } from '@/lib/palettes';

export function Providers({ palette, children }: { palette: PaletteId; children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => {
              if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 404)) return false;
              return count < 1;
            },
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <PaletteProvider initial={palette}>
        <TooltipProvider>{children}</TooltipProvider>
      </PaletteProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  );
}
