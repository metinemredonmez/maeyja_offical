'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import type { CronJobState, CronRun, Paginated } from '@/lib/types';

export const cronKeys = {
  all: ['cron'] as const,
  jobs: ['cron', 'jobs'] as const,
  runs: (p: { name?: string; page: number; limit: number }) => ['cron', 'runs', p] as const,
};

export const useCronJobs = () => useQuery({ queryKey: cronKeys.jobs, queryFn: () => api.get<CronJobState[]>('/admin/cron'), refetchInterval: 15_000 });

export const useCronRuns = (params: { name?: string; page: number; limit: number }) =>
  useQuery({ queryKey: cronKeys.runs(params), queryFn: () => api.get<Paginated<CronRun>>(`/admin/cron/runs${qs(params)}`), placeholderData: keepPreviousData });

/** Starts the job in the background; the list refreshes itself while it runs. */
export const useRunCronJob = () =>
  useApiMutation<{ started: boolean }, string>({ mutationFn: (name) => api.post(`/admin/cron/${encodeURIComponent(name)}/run`), invalidate: [cronKeys.all], success: 'İş başlatıldı' });
