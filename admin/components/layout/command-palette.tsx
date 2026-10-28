'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardListIcon, ShoppingBagIcon, UserIcon } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { StatusBadge } from '@/components/shared/status-badge';
import { Money } from '@/components/shared/primitives';
import { navForRole } from '@/components/layout/nav';
import { useDebounce } from '@/hooks/use-debounce';
import { useOrders } from '@/lib/queries/orders';
import { useProducts } from '@/lib/queries/catalog';
import { useUsers } from '@/lib/queries/users';
import { fullName } from '@/lib/format';
import type { UserRole } from '@/lib/types';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; role: UserRole | undefined };

/** ⌘K palette: jumps to orders by number, products, customers and pages. */
export function CommandPalette({ open, onOpenChange, role }: Props) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const debounced = useDebounce(q.trim(), 250);
  const canSell = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const active = open && canSell && debounced.length >= 2;

  const orders = useOrders({ page: 1, limit: 5, q: debounced }, active);
  const products = useProducts({ page: 1, limit: 5, q: debounced }, active);
  const users = useUsers({ page: 1, limit: 5, q: debounced }, active);

  const close = (o: boolean) => {
    if (!o) setQ('');
    onOpenChange(o);
  };

  const go = (href: string) => {
    close(false);
    router.push(href);
  };

  const pages = navForRole(role).flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
  const searching = active && (orders.isFetching || products.isFetching || users.isFetching);

  return (
    <CommandDialog open={open} onOpenChange={close} title="Hızlı arama" description="Sipariş no, ürün, müşteri veya sayfa ara" className="sm:max-w-xl">
      <CommandInput placeholder="Sipariş no, ürün, müşteri veya sayfa…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>{searching ? 'Aranıyor…' : 'Sonuç yok'}</CommandEmpty>
        {active && (orders.data?.items.length ?? 0) > 0 && (
          <CommandGroup heading="Siparişler">
            {orders.data!.items.map((o) => (
              <CommandItem key={o.id} value={`order-${o.id}`} onSelect={() => go(`/orders/${o.id}`)} className="gap-2">
                <ClipboardListIcon className="size-4 text-muted-foreground" />
                <span className="font-medium tabular-nums">{o.orderNumber}</span>
                <span className="truncate text-muted-foreground">{o.customerName || o.email}</span>
                <span className="ml-auto flex items-center gap-2">
                  <Money value={o.total} className="text-xs" />
                  <StatusBadge kind="order" value={o.status} />
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {active && (products.data?.items.length ?? 0) > 0 && (
          <CommandGroup heading="Ürünler">
            {products.data!.items.map((p) => (
              <CommandItem key={p.id} value={`product-${p.id}`} onSelect={() => go(`/products/${p.id}`)} className="gap-2">
                <ShoppingBagIcon className="size-4 text-muted-foreground" />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto">
                  <StatusBadge kind="product" value={p.status} />
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {active && (users.data?.items.length ?? 0) > 0 && (
          <CommandGroup heading="Müşteriler">
            {users.data!.items.map((u) => (
              <CommandItem key={u.id} value={`user-${u.id}`} onSelect={() => go(`/customers/${u.id}`)} className="gap-2">
                <UserIcon className="size-4 text-muted-foreground" />
                <span className="truncate">{fullName(u)}</span>
                <span className="truncate text-muted-foreground">{u.email}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {active && <CommandSeparator />}
        <CommandGroup heading="Sayfalar">
          {pages.map((p) => (
            <CommandItem key={p.href} value={`page-${p.group}-${p.label}`} onSelect={() => go(p.href)} className="gap-2">
              <p.icon className="size-4 text-muted-foreground" />
              <span>{p.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{p.group}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
