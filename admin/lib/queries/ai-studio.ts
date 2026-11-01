'use client';

import { useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api.client';
import { catalogKeys } from '@/lib/queries/catalog';
import { contentKeys } from '@/lib/queries/content';
import { useApiMutation } from '@/lib/queries/helpers';

export type StudioKind = 'model' | 'scene' | 'video';
export type Carry = 'auto' | 'hand' | 'strap' | 'shoulder' | 'underarm';
export type StudioInput = { kind: StudioKind; imageUrl: string; productId?: string; carry?: Carry; note?: string };
export type AiSuggestion = {
  id: string;
  productId: string | null;
  kind: StudioKind;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sourceUrl: string | null;
  status: 'pending' | 'added' | 'banner' | 'dismissed';
  auto: boolean;
  createdAt: string;
};
type Job = { status: 'working' | 'done' | 'failed'; suggestionId?: string; error?: string };

export const studioKeys = {
  all: ['ai-suggestions'] as const,
  list: (p: { productId?: string; status?: string }) => ['ai-suggestions', p] as const,
};

export const useSuggestions = (params: { productId?: string; status?: string } = {}, enabled = true) =>
  useQuery({ queryKey: studioKeys.list(params), queryFn: () => api.get<AiSuggestion[]>(`/admin/ai/studio/suggestions${qs(params)}`), enabled });

/** Starts a job and waits for it (a photo takes ~30 s, a film a few minutes); resolves with the new suggestion. */
export async function runStudio(input: StudioInput, signal?: AbortSignal): Promise<AiSuggestion> {
  const { id } = await api.post<{ id: string }>('/admin/ai/studio', input);
  const started = Date.now();
  while (Date.now() - started < 20 * 60_000) {
    await new Promise((r) => setTimeout(r, input.kind === 'video' ? 8000 : 4000));
    if (signal?.aborted) throw new Error('Vazgeçildi');
    const job = await api.get<Job>(`/admin/ai/studio/jobs/${id}`);
    if (job.status === 'failed') throw new Error(job.error || 'Üretilemedi');
    if (job.status === 'done' && job.suggestionId) {
      const list = await api.get<AiSuggestion[]>(`/admin/ai/studio/suggestions${qs({ status: 'all' })}`);
      const s = list.find((x) => x.id === job.suggestionId);
      if (s) return s;
    }
  }
  throw new Error('Çok uzun sürdü; sonuç hazır olunca AI stüdyoda görünür');
}

export const useAddSuggestionToProduct = () =>
  useApiMutation<unknown, { id: string; productId: string }>({
    mutationFn: ({ id, productId }) => api.post(`/admin/ai/studio/suggestions/${id}/product`, { productId }),
    invalidate: [studioKeys.all, catalogKeys.products],
    success: 'Ürünün fotoğraflarına eklendi',
  });

export const useAddSuggestionAsBanner = () =>
  useApiMutation<unknown, string>({
    mutationFn: (id) => api.post(`/admin/ai/studio/suggestions/${id}/banner`, {}),
    invalidate: [studioKeys.all, contentKeys.home],
    success: 'Ana sayfanın sonuna banner olarak eklendi (Ana sayfa bölümünden yerini değiştirebilirsiniz)',
  });

export const useMarkSuggestionUsed = () =>
  useApiMutation<unknown, string>({ mutationFn: (id) => api.post(`/admin/ai/studio/suggestions/${id}/used`, {}), invalidate: [studioKeys.all], success: false });

export const useDismissSuggestion = () =>
  useApiMutation<unknown, string>({ mutationFn: (id) => api.delete(`/admin/ai/studio/suggestions/${id}`), invalidate: [studioKeys.all], success: 'Kaldırıldı' });
