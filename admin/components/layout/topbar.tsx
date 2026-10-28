'use client';

import Link from 'next/link';
import { KeyRoundIcon, LogOutIcon, MenuIcon, SearchIcon, UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { USER_ROLE } from '@/lib/labels';
import { fullName } from '@/lib/format';
import { useLogout } from '@/lib/queries/auth';
import type { AuthUser } from '@/lib/types';

type Props = { user: AuthUser | undefined; onOpenSearch: () => void; onOpenMenu: () => void };

export function Topbar({ user, onOpenSearch, onOpenMenu }: Props) {
  const logout = useLogout();
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onOpenMenu} aria-label="Menüyü aç">
        <MenuIcon />
      </Button>
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-8 w-full max-w-md items-center gap-2 rounded-lg border bg-muted/40 px-2.5 text-left text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Hızlı arama (⌘K)"
      >
        <SearchIcon className="size-4" />
        <span className="flex-1 truncate">Sipariş no, ürün, müşteri ara…</span>
        <kbd className="hidden rounded border bg-background px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-2 pl-1" aria-label="Kullanıcı menüsü" />}>
            <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">{initials}</span>
            <span className="hidden max-w-40 truncate sm:inline">{fullName(user)}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Base UI requires GroupLabel inside a Group, otherwise opening the menu throws (error #31). */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">{fullName(user)}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{user ? USER_ROLE[user.role] : ''}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/profile" />}>
                <UserIcon /> Profil
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/profile#password" />}>
                <KeyRoundIcon /> Şifre değiştir
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
              <LogOutIcon /> Çıkış
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
