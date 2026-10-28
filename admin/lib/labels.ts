import type {
  ContentStatus,
  CouponType,
  HomeSectionType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  ProductStatus,
  PushStatus,
  ReturnStatus,
  UserRole,
} from '@/lib/types';

/** Muted badge tones used by StatusBadge. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted';

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  PENDING_PAYMENT: { label: 'Ödeme bekliyor', tone: 'warning' },
  PAID: { label: 'Ödendi', tone: 'info' },
  PROCESSING: { label: 'Hazırlanıyor', tone: 'info' },
  SHIPPED: { label: 'Kargoda', tone: 'info' },
  DELIVERED: { label: 'Teslim edildi', tone: 'success' },
  CANCELLED: { label: 'İptal', tone: 'muted' },
  REFUNDED: { label: 'İade edildi', tone: 'danger' },
};
export const ORDER_STATUSES = Object.keys(ORDER_STATUS) as OrderStatus[];

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Taslak', tone: 'neutral' },
  ACTIVE: { label: 'Yayında', tone: 'success' },
  ARCHIVED: { label: 'Arşiv', tone: 'muted' },
};

export const RETURN_STATUS: Record<ReturnStatus, { label: string; tone: Tone }> = {
  REQUESTED: { label: 'Talep edildi', tone: 'warning' },
  APPROVED: { label: 'Onaylandı', tone: 'info' },
  REJECTED: { label: 'Reddedildi', tone: 'muted' },
  RECEIVED: { label: 'Ürün alındı', tone: 'info' },
  REFUNDED: { label: 'İade ödendi', tone: 'success' },
};
export const RETURN_STATUSES = Object.keys(RETURN_STATUS) as ReturnStatus[];

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Bekliyor', tone: 'warning' },
  SUCCEEDED: { label: 'Başarılı', tone: 'success' },
  FAILED: { label: 'Başarısız', tone: 'danger' },
  REFUNDED: { label: 'İade', tone: 'muted' },
};

export const CONTENT_STATUS: Record<ContentStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Taslak', tone: 'neutral' },
  PUBLISHED: { label: 'Yayında', tone: 'success' },
};

export const PUSH_STATUS: Record<PushStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Bekliyor', tone: 'warning' },
  SENT: { label: 'Gönderildi', tone: 'success' },
  FAILED: { label: 'Başarısız', tone: 'danger' },
};

export const PAYMENT_PROVIDER: Record<PaymentProvider, string> = {
  IYZICO: 'iyzico (kart)',
  BANK_TRANSFER: 'Havale / EFT',
};

export const COUPON_TYPE: Record<CouponType, string> = {
  PERCENT: 'Yüzde',
  FIXED: 'Sabit tutar',
  FREE_SHIPPING: 'Ücretsiz kargo',
};

export const USER_ROLE: Record<UserRole, string> = {
  CUSTOMER: 'Müşteri',
  EDITOR: 'Editör',
  ADMIN: 'Yönetici',
  SUPER_ADMIN: 'Süper admin',
};

export const HOME_SECTION_TYPE: Record<HomeSectionType, { label: string; hint: string }> = {
  HERO: { label: 'Hero', hint: 'Tam ekran görsel / video, başlık ve CTA' },
  FEATURED_PRODUCTS: { label: 'Öne çıkan ürünler', hint: 'Seçili ürünler veya öne çıkanlar' },
  COLLECTION: { label: 'Koleksiyon', hint: 'Bir koleksiyonun ürünleri' },
  EDITORIAL: { label: 'Editoryal', hint: 'Görsel + metin bloğu' },
  CRAFT_STORY: { label: 'Zanaat hikâyesi', hint: 'Atölye anlatısı' },
  PRESS: { label: 'Basında', hint: 'Basın öğeleri otomatik gelir' },
  STOCKISTS: { label: 'Satış noktaları', hint: 'Satış noktaları otomatik gelir' },
  NEWSLETTER: { label: 'Bülten', hint: 'E-posta abonelik bloğu' },
};

export const STAFF_ROLES: UserRole[] = ['EDITOR', 'ADMIN', 'SUPER_ADMIN'];
export const ADMIN_ROLES: UserRole[] = ['ADMIN', 'SUPER_ADMIN'];
