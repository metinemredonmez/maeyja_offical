'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import type { ContentStatus, Faq, HomeSection, JournalPost, Page, Paginated, PressItem, Stockist } from '@/lib/types';

export const contentKeys = {
  home: ['home-sections'] as const,
  pages: ['pages'] as const,
  page: (id: string) => ['pages', id] as const,
  journal: ['journal'] as const,
  journalList: (p: JournalListParams) => ['journal', 'list', p] as const,
  journalPost: (id: string) => ['journal', 'detail', id] as const,
  press: ['press'] as const,
  stockists: ['stockists'] as const,
  faq: ['faq'] as const,
};

// ───────────── home sections ─────────────
export type HomeSectionInput = Partial<Omit<HomeSection, 'id'>> & { type: HomeSection['type'] };
export const useHomeSections = () => useQuery({ queryKey: contentKeys.home, queryFn: () => api.get<HomeSection[]>('/admin/home-sections') });
export const useSaveHomeSection = () =>
  useApiMutation<HomeSection, { id?: string; body: HomeSectionInput | Partial<HomeSectionInput> }>({
    mutationFn: ({ id, body }) => (id ? api.patch(`/admin/home-sections/${id}`, body) : api.post('/admin/home-sections', body)),
    invalidate: [contentKeys.home],
  });
export const useDeleteHomeSection = () =>
  useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/home-sections/${id}`), invalidate: [contentKeys.home], success: 'Bölüm silindi' });
export const useReorderHomeSections = () =>
  useApiMutation<HomeSection[], string[]>({ mutationFn: (ids) => api.put('/admin/home-sections/order', { ids }), invalidate: [contentKeys.home], success: 'Sıralama kaydedildi' });

// ───────────── pages ─────────────
export type PageInput = { slug: string; title: string; body: string; status?: ContentStatus; translations?: Record<string, Record<string, string>>; seoTitle?: string; seoDescription?: string };
export const usePages = () => useQuery({ queryKey: contentKeys.pages, queryFn: () => api.get<Page[]>('/admin/pages') });
export const usePage = (id: string | undefined) => useQuery({ queryKey: contentKeys.page(id ?? ''), queryFn: () => api.get<Page>(`/admin/pages/${id}`), enabled: Boolean(id) });
export const useSavePage = () =>
  useApiMutation<Page, { id?: string; body: Partial<PageInput> }>({
    mutationFn: ({ id, body }) => (id ? api.patch(`/admin/pages/${id}`, body) : api.post('/admin/pages', body)),
    invalidate: [contentKeys.pages],
  });
export const useDeletePage = () => useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/pages/${id}`), invalidate: [contentKeys.pages], success: 'Sayfa silindi' });

// ───────────── journal ─────────────
export type JournalListParams = { page: number; limit: number; q?: string; status?: ContentStatus | '' };
export type JournalInput = {
  title: string;
  slug?: string;
  excerpt?: string;
  body: string;
  coverImageUrl?: string;
  status?: ContentStatus;
  publishedAt?: string | null;
  translations?: Record<string, Record<string, string>>;
  seoTitle?: string;
  seoDescription?: string;
};
export const useJournal = (params: JournalListParams) =>
  useQuery({ queryKey: contentKeys.journalList(params), queryFn: () => api.get<Paginated<JournalPost>>(`/admin/journal${qs(params)}`), placeholderData: keepPreviousData });
export const useJournalPost = (id: string | undefined) =>
  useQuery({ queryKey: contentKeys.journalPost(id ?? ''), queryFn: () => api.get<JournalPost>(`/admin/journal/${id}`), enabled: Boolean(id) });
export const useSaveJournalPost = () =>
  useApiMutation<JournalPost, { id?: string; body: Partial<JournalInput> }>({
    mutationFn: ({ id, body }) => (id ? api.patch(`/admin/journal/${id}`, body) : api.post('/admin/journal', body)),
    invalidate: [contentKeys.journal],
  });
export const useDeleteJournalPost = () =>
  useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/journal/${id}`), invalidate: [contentKeys.journal], success: 'Yazı silindi' });

// ───────────── press ─────────────
export type PressInput = Partial<Omit<PressItem, 'id'>> & { publication: string };
export const usePress = () => useQuery({ queryKey: contentKeys.press, queryFn: () => api.get<PressItem[]>('/admin/press') });
export const useSavePress = () =>
  useApiMutation<PressItem, { id?: string; body: PressInput }>({
    mutationFn: ({ id, body }) => (id ? api.patch(`/admin/press/${id}`, body) : api.post('/admin/press', body)),
    invalidate: [contentKeys.press],
  });
export const useDeletePress = () => useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/press/${id}`), invalidate: [contentKeys.press], success: 'Basın öğesi silindi' });

// ───────────── stockists ─────────────
export type StockistInput = Partial<Omit<Stockist, 'id'>> & { name: string; city: string };
export const useStockists = () => useQuery({ queryKey: contentKeys.stockists, queryFn: () => api.get<Stockist[]>('/admin/stockists') });
export const useSaveStockist = () =>
  useApiMutation<Stockist, { id?: string; body: StockistInput }>({
    mutationFn: ({ id, body }) => (id ? api.patch(`/admin/stockists/${id}`, body) : api.post('/admin/stockists', body)),
    invalidate: [contentKeys.stockists],
  });
export const useDeleteStockist = () =>
  useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/stockists/${id}`), invalidate: [contentKeys.stockists], success: 'Satış noktası silindi' });

// ───────────── faq ─────────────
export type FaqInput = Partial<Omit<Faq, 'id'>> & { question: string; answer: string };
export const useFaq = () => useQuery({ queryKey: contentKeys.faq, queryFn: () => api.get<Faq[]>('/admin/faq') });
export const useSaveFaq = () =>
  useApiMutation<Faq, { id?: string; body: FaqInput }>({
    mutationFn: ({ id, body }) => (id ? api.patch(`/admin/faq/${id}`, body) : api.post('/admin/faq', body)),
    invalidate: [contentKeys.faq],
  });
export const useDeleteFaq = () => useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/faq/${id}`), invalidate: [contentKeys.faq], success: 'Soru silindi' });
