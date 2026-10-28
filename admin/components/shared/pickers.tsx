'use client';

import { useState } from 'react';
import { CheckIcon, PlusIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Thumb } from '@/components/shared/primitives';
import { useDebounce } from '@/hooks/use-debounce';
import { useProducts } from '@/lib/queries/catalog';
import { useUsers } from '@/lib/queries/users';
import { fullName } from '@/lib/format';
import type { ProductListItem } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Multi-select of products by search; keeps a local cache of chosen rows for labels. */
export function ProductPicker({ value, onChange, max }: { value: string[]; onChange: (ids: string[]) => void; max?: number }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);
  const [cache, setCache] = useState<Record<string, ProductListItem>>({});
  const list = useProducts({ page: 1, limit: 20, q: debounced || undefined }, open);
  // keep labels for ids we have not seen in the search (initial values)
  const missing = value.filter((id) => !cache[id]);
  const hydrate = useProducts({ page: 1, limit: 100 }, missing.length > 0);
  const all = { ...cache };
  for (const p of hydrate.data?.items ?? []) all[p.id] = p;
  for (const p of list.data?.items ?? []) all[p.id] = p;

  const toggle = (p: ProductListItem) => {
    setCache((c) => ({ ...c, [p.id]: p }));
    if (value.includes(p.id)) onChange(value.filter((v) => v !== p.id));
    else if (!max || value.length < max) onChange([...value, p.id]);
  };

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1.5">
        {value.map((id) => (
          <li key={id} className="flex items-center gap-1.5 rounded-full border bg-background py-0.5 pr-1 pl-0.5 text-xs">
            <Thumb src={all[id]?.thumbnail} size="sm" className="size-5 rounded-full" />
            <span className="max-w-40 truncate">{all[id]?.name ?? '…'}</span>
            <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} className="rounded-full p-0.5 hover:bg-muted" aria-label="Kaldır">
              <XIcon className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>
          <PlusIcon /> Ürün ekle
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Ürün adı / SKU…" value={q} onValueChange={setQ} />
            <CommandList>
              <CommandEmpty>{list.isPending ? 'Aranıyor…' : 'Ürün bulunamadı'}</CommandEmpty>
              <CommandGroup>
                {list.data?.items.map((p) => (
                  <CommandItem key={p.id} value={p.id} onSelect={() => toggle(p)} className="gap-2">
                    <Thumb src={p.thumbnail} size="sm" />
                    <span className="flex-1 truncate">{p.name}</span>
                    {value.includes(p.id) && <CheckIcon className="size-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Multi-select of users (push targets). */
export function UserPicker({ value, onChange, className }: { value: string[]; onChange: (ids: string[]) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const list = useUsers({ page: 1, limit: 20, q: debounced || undefined }, open);

  return (
    <div className={cn('space-y-2', className)}>
      <ul className="flex flex-wrap gap-1.5">
        {value.map((id) => (
          <li key={id} className="flex items-center gap-1 rounded-full border bg-background py-0.5 pr-1 pl-2 text-xs">
            <span className="max-w-48 truncate">{labels[id] ?? id}</span>
            <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} className="rounded-full p-0.5 hover:bg-muted" aria-label="Kaldır">
              <XIcon className="size-3" />
            </button>
          </li>
        ))}
      </ul>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>
          <PlusIcon /> Kullanıcı ekle
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="E-posta / ad…" value={q} onValueChange={setQ} />
            <CommandList>
              <CommandEmpty>{list.isPending ? 'Aranıyor…' : 'Kullanıcı bulunamadı'}</CommandEmpty>
              <CommandGroup>
                {list.data?.items.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={u.id}
                    onSelect={() => {
                      setLabels((l) => ({ ...l, [u.id]: `${fullName(u)} · ${u.email}` }));
                      onChange(value.includes(u.id) ? value.filter((v) => v !== u.id) : [...value, u.id]);
                    }}
                    className="gap-2"
                  >
                    <span className="flex-1 truncate">
                      {fullName(u)} <span className="text-muted-foreground">· {u.email}</span>
                    </span>
                    {value.includes(u.id) && <CheckIcon className="size-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
