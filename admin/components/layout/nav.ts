import type { LucideIcon } from 'lucide-react';
import {
  BellRingIcon,
  BookOpenIcon,
  ClipboardListIcon,
  FileTextIcon,
  HelpCircleIcon,
  HomeIcon,
  ImageIcon,
  LayersIcon,
  LayoutDashboardIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  NewspaperIcon,
  PaletteIcon,
  RotateCcwIcon,
  SendIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TagIcon,
  TicketPercentIcon,
  UsersIcon,
  UserCogIcon,
  FolderTreeIcon,
} from 'lucide-react';
import type { UserRole } from '@/lib/types';

export type NavItem = { href: string; label: string; icon: LucideIcon; roles: UserRole[] };
export type NavGroup = { label: string; items: NavItem[] };

const ALL: UserRole[] = ['ADMIN', 'SUPER_ADMIN'];
const STAFF: UserRole[] = ['EDITOR', 'ADMIN', 'SUPER_ADMIN'];
const SUPER: UserRole[] = ['SUPER_ADMIN'];

export const NAV: NavGroup[] = [
  {
    label: 'Genel',
    items: [{ href: '/', label: 'Panel', icon: LayoutDashboardIcon, roles: ALL }],
  },
  {
    label: 'Katalog',
    items: [
      { href: '/products', label: 'Ürünler', icon: ShoppingBagIcon, roles: ALL },
      { href: '/categories', label: 'Kategoriler', icon: FolderTreeIcon, roles: ALL },
      { href: '/collections', label: 'Koleksiyonlar', icon: LayersIcon, roles: ALL },
      { href: '/colors', label: 'Renkler', icon: PaletteIcon, roles: ALL },
      { href: '/media', label: 'Medya', icon: ImageIcon, roles: STAFF },
    ],
  },
  {
    label: 'Satış',
    items: [
      { href: '/orders', label: 'Siparişler', icon: ClipboardListIcon, roles: ALL },
      { href: '/returns', label: 'İadeler', icon: RotateCcwIcon, roles: ALL },
      { href: '/coupons', label: 'Kuponlar', icon: TicketPercentIcon, roles: ALL },
      { href: '/customers', label: 'Müşteriler', icon: UsersIcon, roles: ALL },
    ],
  },
  {
    label: 'İçerik',
    items: [
      { href: '/content/home', label: 'Ana sayfa', icon: HomeIcon, roles: STAFF },
      { href: '/content/pages', label: 'Sayfalar', icon: FileTextIcon, roles: STAFF },
      { href: '/content/journal', label: 'Journal', icon: BookOpenIcon, roles: STAFF },
      { href: '/content/press', label: 'Basın', icon: NewspaperIcon, roles: STAFF },
      { href: '/content/stockists', label: 'Satış noktaları', icon: MapPinIcon, roles: STAFF },
      { href: '/content/faq', label: 'SSS', icon: HelpCircleIcon, roles: STAFF },
    ],
  },
  {
    label: 'Pazarlama',
    items: [
      { href: '/campaigns', label: 'E-posta kampanyaları', icon: SendIcon, roles: ALL },
      { href: '/newsletter', label: 'Bülten', icon: MailIcon, roles: ALL },
      { href: '/messages', label: 'Mesajlar', icon: MessageSquareIcon, roles: ALL },
      { href: '/push', label: 'Push bildirim', icon: BellRingIcon, roles: ALL },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { href: '/settings', label: 'Ayarlar', icon: SettingsIcon, roles: ALL },
      { href: '/staff', label: 'Personel', icon: UserCogIcon, roles: SUPER },
      { href: '/audit-logs', label: 'İşlem kayıtları', icon: TagIcon, roles: ALL },
    ],
  },
];

export function navForRole(role: UserRole | undefined): NavGroup[] {
  if (!role) return [];
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length > 0);
}

/** Where a role lands after login. */
export function homeForRole(role: UserRole | undefined) {
  return role === 'EDITOR' ? '/content/home' : '/';
}
