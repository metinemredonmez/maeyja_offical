'use client';

import { useMutation, useQueryClient, type QueryKey, type UseMutationOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api.client';

type Opts<TData, TVars> = {
  mutationFn: (vars: TVars) => Promise<TData>;
  /** Query keys (prefixes) to invalidate on success. */
  invalidate?: QueryKey[];
  /** Toast text, or a function of the result. `false` disables the toast. */
  success?: string | false | ((data: TData, vars: TVars) => string);
  onSuccess?: (data: TData, vars: TVars) => void | Promise<void>;
  onError?: (error: Error, vars: TVars) => void;
} & Omit<UseMutationOptions<TData, Error, TVars>, 'mutationFn' | 'onSuccess' | 'onError'>;

/** Mutation with toast + invalidation baked in; every write in the panel goes through this. */
export function useApiMutation<TData = unknown, TVars = void>({ mutationFn, invalidate = [], success = 'Kaydedildi', onSuccess, onError, ...rest }: Opts<TData, TVars>) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn,
    ...rest,
    onSuccess: async (data, vars) => {
      await Promise.all(invalidate.map((key) => qc.invalidateQueries({ queryKey: key })));
      if (success !== false) toast.success(typeof success === 'function' ? success(data, vars) : success);
      await onSuccess?.(data, vars);
    },
    onError: (error, vars) => {
      toast.error(errorMessage(error));
      onError?.(error, vars);
    },
  });
}
