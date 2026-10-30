import type { Translations } from '@/lib/i18n';

// ───────────── enums (mirror prisma/schema.prisma) ─────────────
export type UserRole = 'CUSTOMER' | 'EDITOR' | 'ADMIN' | 'SUPER_ADMIN';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
export type PaymentProvider = 'IYZICO' | 'BANK_TRANSFER';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
export type CouponType = 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';
export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'REFUNDED';
export type ContentStatus = 'DRAFT' | 'PUBLISHED';
export type HomeSectionType = 'HERO' | 'FEATURED_PRODUCTS' | 'COLLECTION' | 'EDITORIAL' | 'CRAFT_STORY' | 'PRESS' | 'STOCKISTS' | 'NEWSLETTER';
export type PushTarget = 'ALL' | 'USERS';
export type PushStatus = 'PENDING' | 'SENT' | 'FAILED';
export type DevicePlatform = 'IOS' | 'ANDROID' | 'WEB';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ───────────── identity ─────────────
export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: UserRole;
  locale: string;
  marketingOptIn: boolean;
  emailVerified: boolean;
  /** TOTP two-factor enrolled (staff). */
  mfaEnabled?: boolean;
  createdAt: string;
}

export interface MfaStatus {
  enabled: boolean;
  backupCodesLeft: number;
}

export interface MfaSetup {
  secret: string;
  otpauth: string;
  qrDataUrl: string;
}

export interface AdminUserRow extends AuthUser {
  isActive: boolean;
  lastLoginAt: string | null;
  orderCount: number;
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

export interface AdminUserDetail extends AuthUser {
  isActive: boolean;
  lastLoginAt: string | null;
  addresses: Address[];
  orders: { id: string; orderNumber: string; status: OrderStatus; total: number; createdAt: string }[];
  totalSpent: number;
}

// ───────────── catalog ─────────────
export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  translations: Translations | null;
  seoTitle: string | null;
  seoDescription: string | null;
  _count?: { products: number };
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  translations: Translations | null;
  seoTitle: string | null;
  seoDescription: string | null;
  _count?: { products: number };
}

export interface Color {
  id: string;
  name: string;
  slug: string;
  hex: string;
  hex2: string | null;
  sortOrder: number;
  translations: Translations | null;
  _count?: { variants: number };
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  colorId: string | null;
  size: string | null;
  price: number | null;
  compareAtPrice: number | null;
  stock: number;
  barcode: string | null;
  weightGrams: number | null;
  isActive: boolean;
  sortOrder: number;
  color?: Color | null;
  stockAlertsWaiting?: number;
}

export interface ProductImage {
  id: string;
  productId: string;
  colorId: string | null;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  status: ProductStatus;
  isFeatured: boolean;
  basePrice: number;
  compareAtPrice: number | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  thumbnail: string | null;
  variantCount: number;
  totalStock: number;
  lowStock: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  story: string | null;
  material: string | null;
  care: string | null;
  dimensions: string | null;
  madeIn: string | null;
  sizeGuide: string | null;
  status: ProductStatus;
  isFeatured: boolean;
  basePrice: number;
  compareAtPrice: number | null;
  taxRate: number | null;
  categoryId: string | null;
  sortOrder: number;
  tags: string[];
  translations: Translations | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: Category | null;
  collectionIds: string[];
  variants: ProductVariant[];
  images: ProductImage[];
}

export interface Media {
  id: string;
  url: string;
  key: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  renditions: Record<string, string> | null;
  createdAt: string;
}

// ───────────── orders ─────────────
export interface OrderAddress {
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  city?: string;
  district?: string;
  line1?: string;
  line2?: string;
  postalCode?: string;
  invoiceType?: 'INDIVIDUAL' | 'CORPORATE';
  identityNumber?: string;
  companyName?: string;
  taxOffice?: string;
  taxNumber?: string;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  email: string;
  customerName: string;
  city?: string;
  total: number;
  paymentProvider: PaymentProvider;
  itemCount: number;
  isGuest: boolean;
  createdAt: string;
}

export interface OrderListResponse extends Paginated<OrderListItem> {
  statusCounts: Partial<Record<OrderStatus, number>>;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string;
  colorName: string | null;
  size: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  taxRate: number;
}

export interface Payment {
  id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  providerPaymentId: string | null;
  cardLast4: string | null;
  cardAssociation: string | null;
  installment: number | null;
  failureReason: string | null;
  createdAt: string;
}

export interface OrderHistory {
  id: string;
  from: OrderStatus | null;
  to: OrderStatus;
  note: string | null;
  actorId: string | null;
  actor: { id: string; firstName: string | null; email: string } | null;
  createdAt: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  userId: string | null;
  email: string;
  reason: string;
  items: { orderItemId: string; quantity: number }[];
  status: ReturnStatus;
  adminNote: string | null;
  refundedAt: string | null;
  createdAt: string;
  order?: { id: string; orderNumber: string; total: number; items: OrderItem[] };
}

export interface Carrier {
  code: string;
  name: string;
  trackingUrl: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  userId: string | null;
  email: string;
  phone: string | null;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  couponCode: string | null;
  paymentProvider: PaymentProvider;
  shippingAddress: OrderAddress;
  billingAddress: OrderAddress;
  customerNote: string | null;
  adminNote: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  locale: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: OrderItem[];
  payments: Payment[];
  history: OrderHistory[];
  returnRequests: ReturnRequest[];
  user: { id: string; email: string; firstName: string | null; lastName: string | null; phone: string | null; createdAt: string; _count: { orders: number } } | null;
  allowedTransitions: OrderStatus[];
  carriers: Carrier[];
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
  redemptions?: { id: string; email: string; createdAt: string; order: { orderNumber: string; total: number } }[];
}

// ───────────── content ─────────────
export interface HomeSection {
  id: string;
  type: HomeSectionType;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  secondImageUrl: string | null;
  videoUrl: string | null;
  layout: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  payload: { productIds?: string[]; collectionSlug?: string; limit?: number } | null;
  sortOrder: number;
  isActive: boolean;
  translations: Translations | null;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  body?: string;
  status: ContentStatus;
  translations: Translations | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

export interface JournalPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body?: string;
  coverImageUrl: string | null;
  status: ContentStatus;
  publishedAt: string | null;
  translations: Translations | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PressItem {
  id: string;
  publication: string;
  title: string | null;
  quote: string | null;
  url: string | null;
  logoUrl: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  sortOrder: number;
  isActive: boolean;
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
  sortOrder: number;
  isActive: boolean;
}

export interface Faq {
  id: string;
  group: string | null;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
  translations: Translations | null;
}

export interface Subscriber {
  id: string;
  email: string;
  locale: string;
  source: string | null;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface PushCampaign {
  id: string;
  title: string;
  body: string;
  url: string | null;
  imageUrl: string | null;
  target: PushTarget;
  targetUserIds: string[];
  status: PushStatus;
  recipients: number | null;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface PushListResponse extends Paginated<PushCampaign> {
  devices: { platform: DevicePlatform; _count: number }[];
  providerEnabled: boolean;
}

// ───────────── system ─────────────
export interface Settings {
  store: { name: string; tagline: string; email: string; phone: string; address: string; instagram: string; announcement: Record<string, string> };
  shipping: { flatRate: number; freeShippingThreshold: number; estimatedDays: string; carriers: Carrier[] };
  tax: { defaultRate: number };
  checkout: { guestCheckout: boolean; maxQtyPerItem: number };
  bankTransfer: { enabled: boolean; bankName: string; accountName: string; iban: string; note: Record<string, string> };
  assistant: { enabled: boolean; welcome: Record<string, string>; instructions: string; handoffWhatsapp: string };
  tryon: { enabled: boolean };
}
export type SettingKey = keyof Settings;

export interface AuditLog {
  id: string;
  actorId: string | null;
  actor: { id: string; email: string; firstName: string | null } | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
  createdAt: string;
}

export interface RevenueBucket {
  total: number;
  orders: number;
  averageOrderValue: number;
}

export interface Dashboard {
  revenue: { today: RevenueBucket; last7Days: RevenueBucket; last30Days: RevenueBucket; previous30Days: RevenueBucket; changePct: number | null };
  statusCounts: Partial<Record<OrderStatus, number>>;
  toShip: number;
  daily: { date: string; revenue: number; orders: number }[];
  topProducts: { productId: string | null; name: string; quantity: number; revenue: number }[];
  lowStock: { variantId: string; productId: string; productName: string; sku: string; color: { name: string; hex: string } | null; size: string | null; stock: number; waitingAlerts: number }[];
  recentOrders: { id: string; orderNumber: string; status: OrderStatus; total: number; email: string; createdAt: string; paymentProvider: PaymentProvider }[];
  newCustomers30d: number;
  pendingReturns: number;
  unreadMessages: number;
  subscribers: number;
}

// ───────── E-mail campaigns ─────────
export type CampaignStatus = 'DRAFT' | 'SENDING' | 'SENT' | 'CANCELLED';
export type CampaignAudience = 'ALL' | 'SUBSCRIBERS' | 'CUSTOMERS';

export interface EmailCampaign {
  id: string;
  subject: string;
  preheader: string | null;
  title: string | null;
  imageUrl: string | null;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  audience: CampaignAudience;
  /** null → every language */
  locale: string | null;
  status: CampaignStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailCampaignDetail extends EmailCampaign {
  pendingCount: number;
  failures: { email: string; error: string | null }[];
  mailEnabled: boolean;
}

// ───────── Mailbox (webmail) ─────────
export type MailDirection = 'INBOUND' | 'OUTBOUND';
export type MailFolder = 'INBOX' | 'SENT';

export interface MailAccount {
  id: string;
  email: string;
  fromName: string | null;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  /** Accept a self-signed TLS certificate (our own mail server on 127.0.0.1). */
  allowSelfSigned: boolean;
  isActive: boolean;
  isDefault: boolean;
  signatureHtml: string | null;
  lastFetchAt: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastError: string | null;
  unreadCount: number;
  createdAt: string;
}

export interface MailAddress {
  name: string | null;
  address: string;
}

export interface MailMessageSummary {
  id: string;
  accountId: string;
  accountEmail: string;
  direction: MailDirection;
  from: MailAddress;
  to: MailAddress[];
  subject: string | null;
  snippet: string;
  isRead: boolean;
  hasAttachments: boolean;
  date: string;
}

export interface MailAttachmentMeta {
  index: number;
  filename: string;
  contentType: string;
  size: number;
}

export interface MailMessage extends MailMessageSummary {
  cc: MailAddress[];
  replyTo: MailAddress[];
  /** Sanitised server-side; only ever rendered inside a sandboxed iframe. */
  html: string | null;
  text: string | null;
  attachments: MailAttachmentMeta[];
  messageId: string | null;
  inReplyTo: string | null;
  status: 'SENT' | 'FAILED' | null;
  error: string | null;
}

export interface MailTestResult {
  imap: { ok: boolean; error?: string };
  smtp: { ok: boolean; error?: string };
}

export interface MailSyncResult {
  fetched: number;
  errors: { email: string; error: string }[];
}
