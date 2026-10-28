'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api.client';
import { useApiMutation } from '@/lib/queries/helpers';
import type { Category, Collection, Color, Media, Paginated, Product, ProductImage, ProductListItem, ProductStatus, ProductVariant } from '@/lib/types';

export const catalogKeys = {
  products: ['products'] as const,
  productList: (params: ProductListParams) => ['products', 'list', params] as const,
  product: (id: string) => ['products', 'detail', id] as const,
  categories: ['categories'] as const,
  collections: ['collections'] as const,
  colors: ['colors'] as const,
  media: ['media'] as const,
  mediaList: (params: { page: number; limit: number; q?: string }) => ['media', 'list', params] as const,
};

export type ProductListParams = { page: number; limit: number; q?: string; status?: ProductStatus | ''; categoryId?: string; lowStock?: boolean };

// ───────────── products ─────────────
export function useProducts(params: ProductListParams, enabled = true) {
  return useQuery({
    queryKey: catalogKeys.productList(params),
    queryFn: () => api.get<Paginated<ProductListItem>>(`/admin/products${qs({ ...params, lowStock: params.lowStock ? 'true' : undefined })}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({ queryKey: catalogKeys.product(id ?? ''), queryFn: () => api.get<Product>(`/admin/products/${id}`), enabled: Boolean(id) });
}

export type VariantInput = {
  sku: string;
  colorId?: string | null;
  size?: string | null;
  price?: number | null;
  compareAtPrice?: number | null;
  stock: number;
  barcode?: string;
  weightGrams?: number;
  isActive?: boolean;
  sortOrder?: number;
};
export type ImageInput = { url: string; alt?: string; colorId?: string | null; width?: number; height?: number; sortOrder?: number };

export type ProductInput = {
  name: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  story?: string;
  material?: string;
  care?: string;
  dimensions?: string;
  madeIn?: string;
  sizeGuide?: string;
  status?: ProductStatus;
  isFeatured?: boolean;
  basePrice: number;
  compareAtPrice?: number | null;
  taxRate?: number | null;
  categoryId?: string | null;
  sortOrder?: number;
  tags?: string[];
  translations?: Record<string, Record<string, string>>;
  seoTitle?: string;
  seoDescription?: string;
  collectionIds?: string[];
  variants?: VariantInput[];
  images?: ImageInput[];
};

export const useCreateProduct = () =>
  useApiMutation<Product, ProductInput>({ mutationFn: (body) => api.post('/admin/products', body), invalidate: [catalogKeys.products], success: 'Ürün oluşturuldu' });

export const useUpdateProduct = (id: string) =>
  useApiMutation<Product, Partial<ProductInput>>({
    mutationFn: (body) => api.patch(`/admin/products/${id}`, body),
    invalidate: [catalogKeys.products],
    success: 'Ürün güncellendi',
  });

export const useDeleteProduct = () =>
  useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/products/${id}`), invalidate: [catalogKeys.products], success: 'Ürün arşivlendi' });

export const useDuplicateProduct = () =>
  useApiMutation<Product, string>({ mutationFn: (id) => api.post(`/admin/products/${id}/duplicate`), invalidate: [catalogKeys.products], success: 'Ürün kopyalandı' });

// variants
export const useAddVariant = (productId: string) =>
  useApiMutation<ProductVariant, VariantInput>({
    mutationFn: (body) => api.post(`/admin/products/${productId}/variants`, body),
    invalidate: [catalogKeys.product(productId), catalogKeys.products],
    success: 'Varyant eklendi',
  });
export const useUpdateVariant = (productId: string) =>
  useApiMutation<ProductVariant, { id: string; body: Partial<VariantInput> }>({
    mutationFn: ({ id, body }) => api.patch(`/admin/variants/${id}`, body),
    invalidate: [catalogKeys.product(productId), catalogKeys.products],
    success: 'Varyant güncellendi',
  });
export const useDeleteVariant = (productId: string) =>
  useApiMutation<{ ok: true }, string>({
    mutationFn: (id) => api.delete(`/admin/variants/${id}`),
    invalidate: [catalogKeys.product(productId), catalogKeys.products],
    success: 'Varyant silindi',
  });
export const useUpdateStock = (productId: string) =>
  useApiMutation<ProductVariant, { id: string; stock?: number; delta?: number }>({
    mutationFn: ({ id, ...body }) => api.patch(`/admin/variants/${id}/stock`, body),
    invalidate: [catalogKeys.product(productId), catalogKeys.products],
    success: (v) => `Stok: ${v.stock}`,
  });

// images
export const useAddImage = (productId: string) =>
  useApiMutation<ProductImage, ImageInput>({
    mutationFn: (body) => api.post(`/admin/products/${productId}/images`, body),
    invalidate: [catalogKeys.product(productId), catalogKeys.products],
    success: 'Görsel eklendi',
  });
export const useUpdateImage = (productId: string) =>
  useApiMutation<ProductImage, { id: string; body: Partial<ImageInput> }>({
    mutationFn: ({ id, body }) => api.patch(`/admin/images/${id}`, body),
    invalidate: [catalogKeys.product(productId)],
    success: 'Görsel güncellendi',
  });
export const useDeleteImage = (productId: string) =>
  useApiMutation<{ ok: true }, string>({
    mutationFn: (id) => api.delete(`/admin/images/${id}`),
    invalidate: [catalogKeys.product(productId), catalogKeys.products],
    success: 'Görsel silindi',
  });
export const useReorderImages = (productId: string) =>
  useApiMutation<ProductImage[], string[]>({
    mutationFn: (ids) => api.put(`/admin/products/${productId}/images/order`, { ids }),
    invalidate: [catalogKeys.product(productId), catalogKeys.products],
    success: 'Sıralama kaydedildi',
  });

// ───────────── taxonomy ─────────────
export const useCategories = () => useQuery({ queryKey: catalogKeys.categories, queryFn: () => api.get<Category[]>('/admin/categories'), staleTime: 60_000 });
export const useCollections = () => useQuery({ queryKey: catalogKeys.collections, queryFn: () => api.get<Collection[]>('/admin/collections'), staleTime: 60_000 });
export const useColors = () => useQuery({ queryKey: catalogKeys.colors, queryFn: () => api.get<Color[]>('/admin/colors'), staleTime: 60_000 });

type CategoryInput = Partial<Omit<Category, 'id' | '_count'>> & { name: string };
type CollectionInput = Partial<Omit<Collection, 'id' | '_count'>> & { name: string };
type ColorInput = Partial<Omit<Color, 'id' | '_count'>> & { name: string; hex: string };

export const useSaveCategory = () =>
  useApiMutation<Category, { id?: string; body: CategoryInput }>({
    mutationFn: ({ id, body }) => (id ? api.patch(`/admin/categories/${id}`, body) : api.post('/admin/categories', body)),
    invalidate: [catalogKeys.categories],
  });
export const useDeleteCategory = () =>
  useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/categories/${id}`), invalidate: [catalogKeys.categories, catalogKeys.products], success: 'Kategori silindi' });

export const useSaveCollection = () =>
  useApiMutation<Collection, { id?: string; body: CollectionInput }>({
    mutationFn: ({ id, body }) => (id ? api.patch(`/admin/collections/${id}`, body) : api.post('/admin/collections', body)),
    invalidate: [catalogKeys.collections],
  });
export const useDeleteCollection = () =>
  useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/collections/${id}`), invalidate: [catalogKeys.collections], success: 'Koleksiyon silindi' });

export const useSaveColor = () =>
  useApiMutation<Color, { id?: string; body: ColorInput }>({
    mutationFn: ({ id, body }) => (id ? api.patch(`/admin/colors/${id}`, body) : api.post('/admin/colors', body)),
    invalidate: [catalogKeys.colors],
  });
export const useDeleteColor = () =>
  useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/colors/${id}`), invalidate: [catalogKeys.colors], success: 'Renk silindi' });

// ───────────── media ─────────────
export function useMediaList(params: { page: number; limit: number; q?: string }, enabled = true) {
  return useQuery({
    queryKey: catalogKeys.mediaList(params),
    queryFn: () => api.get<Paginated<Media>>(`/admin/media${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function uploadMedia(file: File, alt?: string) {
  const fd = new FormData();
  fd.append('file', file);
  if (alt) fd.append('alt', alt);
  return api.post<Media>('/admin/media', fd);
}

export const useUploadMedia = () =>
  useApiMutation<Media, { file: File; alt?: string }>({ mutationFn: ({ file, alt }) => uploadMedia(file, alt), invalidate: [catalogKeys.media], success: 'Yüklendi' });
export const useUpdateMediaAlt = () =>
  useApiMutation<Media, { id: string; alt: string }>({ mutationFn: ({ id, alt }) => api.patch(`/admin/media/${id}`, { alt }), invalidate: [catalogKeys.media], success: 'Alt metin kaydedildi' });
export const useDeleteMedia = () =>
  useApiMutation<{ ok: true }, string>({ mutationFn: (id) => api.delete(`/admin/media/${id}`), invalidate: [catalogKeys.media], success: 'Medya silindi' });
