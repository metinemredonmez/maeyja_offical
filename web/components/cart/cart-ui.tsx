'use client';

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

interface CartUi {
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const Ctx = createContext<CartUi>({ open: false, openCart: () => undefined, closeCart: () => undefined });

export function CartUiProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, openCart, closeCart }), [open, openCart, closeCart]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCartUi = () => useContext(Ctx);
