'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * List state (page, q, filters) kept in the URL so back/forward and sharing work.
 * Any key other than `page` resets `page` to 1 when it changes.
 */
export function useListParams<T extends Record<string, string>>(defaults: T & { page?: string; limit?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const params = useMemo(() => {
    const out: Record<string, string> = { ...defaults };
    sp.forEach((v, k) => {
      out[k] = v;
    });
    return out as T & { page: string; limit: string };
  }, [sp, defaults]);

  const set = useCallback(
    (patch: Partial<Record<keyof T | 'page' | 'limit', string | number | undefined>>) => {
      const next = new URLSearchParams(sp.toString());
      let resetPage = false;
      for (const [k, v] of Object.entries(patch)) {
        if (k !== 'page') resetPage = true;
        if (v === undefined || v === '' || v === null || String(v) === String((defaults as Record<string, string>)[k] ?? '')) next.delete(k);
        else next.set(k, String(v));
      }
      if (resetPage && !('page' in patch)) next.delete('page');
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [sp, router, pathname, defaults],
  );

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  return { params, set, page, limit };
}
