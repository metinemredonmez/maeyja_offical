/** Shapes returned by the MAEYJA API (see backend/README.md). Decimals arrive as numbers. */

export interface Image {
  url: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface ColorSwatch {
  slug: string;
  name: string;
  hex: string;
  hex2: string | null;
  inStock: boolean;
}

export interface ProductCard {
  id: string;
  slug: string;
  /** Model number from the admin's product order: 1 → N°01. */
  number?: number | null;
  name: string;
  subtitle: string | null;
  price: number;
  compareAtPrice: number | null;
  hasPriceRange: boolean;
  isFeatured: boolean;
  publishedAt: string | null;
  images: Image[];
  colors: ColorSwatch[];
  inStock: boolean;
}

export interface Variant {
  id: string;
  sku: string;
  size: string | null;
  color: { slug: string; name: string; hex: string; hex2: string | null } | null;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
  lowStock: boolean;
}

export interface Product {
  id: string;
  slug: string;
  number?: number | null;
  name: string;
  subtitle: string | null;
  description: string | null;
  story: string | null;
  material: string | null;
  care: string | null;
  dimensions: string | null;
  madeIn: string | null;
  sizeGuide: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  priceRange: { min: number; max: number } | null;
  category: { slug: string; name: string } | null;
  collections: { slug: string; name: string }[];
  images: (Image & { id: string; colorSlug: string | null; sortOrder: number })[];
  variants: Variant[];
  colors: ColorSwatch[];
  sizes: string[];
  inStock: boolean;
  related: ProductCard[];
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ProductList extends Paginated<ProductCard> {
  facets: {
    colors: { slug: string; name: string; hex: string; hex2: string | null; count: number }[];
    sizes: { size: string; count: number }[];
    price: { min: number; max: number } | null;
  };
}

export interface CartLine {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string | null;
  sku: string;
  colorName: string | null;
  colorHex: string | null;
  size: string | null;
  imageUrl: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  available: boolean;
  maxQuantity: number;
}

export interface Cart {
  id: string | null;
  cartToken: string | null;
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  currency: 'TRY';
  coupon: { code: string; type: string; valid: boolean; message?: string } | null;
  freeShippingRemaining: number | null;
  allAvailable: boolean;
}

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
  locale: string;
  marketingOptIn: boolean;
  emailVerified: boolean;
}

export interface Address {
  id: string;
  title: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  city: string;
  district: string;
  line1: string;
  line2: string | null;
  postalCode: string | null;
  isDefault: boolean;
}

export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items: { productName: string; variantName: string | null; imageUrl: string | null; quantity: number }[];
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  email: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  couponCode: string | null;
  paymentProvider: 'IYZICO' | 'BANK_TRANSFER';
  shippingAddress: Record<string, string>;
  billingAddress: Record<string, string>;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  items: { id: string; productName: string; variantName: string | null; imageUrl: string | null; unitPrice: number; quantity: number; lineTotal: number }[];
  history: { to: OrderStatus; createdAt: string }[];
  returnRequests: { id: string; status: string; reason: string; createdAt: string }[];
  bankTransfer?: { bankName: string; accountName: string; iban: string; note: Record<string, string> };
}

export interface PublicSettings {
  store: { name: string; tagline: string; email: string; phone: string; address: string; instagram: string; announcement: Record<string, string> };
  shipping: { flatRate: number; freeShippingThreshold: number; estimatedDays: string };
  checkout: { guestCheckout: boolean; maxQtyPerItem: number };
  assistant?: { enabled: boolean; welcome: Record<string, string> };
  tryon?: { enabled: boolean };
  bankTransfer: { enabled: boolean; bankName?: string; accountName?: string; iban?: string; note?: Record<string, string> };
}

export type HomeSectionType = 'HERO' | 'FEATURED_PRODUCTS' | 'COLLECTION' | 'EDITORIAL' | 'CRAFT_STORY' | 'PRESS' | 'STOCKISTS' | 'NEWSLETTER';

export interface HomeSection {
  id: string;
  type: HomeSectionType;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  secondImageUrl?: string | null;
  videoUrl: string | null;
  layout?: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  payload: Record<string, unknown> | null;
  products?: ProductCard[];
  press?: PressItem[];
  stockists?: Stockist[];
}

export interface PressItem {
  id: string;
  publication: string;
  title: string | null;
  quote: string | null;
  url: string | null;
  logoUrl: string | null;
  imageUrl: string | null;
}

/** A post from the shop's Instagram account, copied into our uploads by the API. */
export interface InstagramPost {
  id: string;
  image: string;
  permalink: string;
}

export interface Stockist {
  id: string;
  name: string;
  city: string;
  country: string;
  address: string | null;
  phone: string | null;
  url: string | null;
  mapUrl: string | null;
}

export interface Page {
  slug: string;
  title: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

export interface JournalPost {
  slug: string;
  title: string;
  excerpt: string | null;
  body?: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface Faq {
  id: string;
  group: string | null;
  question: string;
  answer: string;
}

export interface CheckoutResult {
  order: { id: string; orderNumber: string; status: OrderStatus; email: string; total: number; paymentProvider: string };
  payment: null | {
    provider: 'IYZICO' | 'BANK_TRANSFER';
    paymentPageUrl?: string;
    checkoutFormContent?: string;
    token?: string;
    bankTransfer?: { bankName: string; accountName: string; iban: string; note: string };
  };
}
