'use client';

import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<unknown>;
};

/** Every destructive action in the panel goes through this. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Onayla', cancelLabel = 'Vazgeç', destructive, loading, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const pending = loading || busy;
  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            className={destructive ? 'bg-[#A3121B] text-white hover:bg-[#8c0f17]' : undefined}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch {
                /* toast handled by mutation */
              } finally {
                setBusy(false);
              }
            }}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Small helper: `const confirm = useConfirm(); confirm.ask({...})` */
export function useConfirm() {
  const [state, setState] = useState<Omit<Props, 'open' | 'onOpenChange'> | null>(null);
  const dialog = state ? <ConfirmDialog open onOpenChange={(o) => !o && setState(null)} {...state} /> : null;
  return { ask: (p: Omit<Props, 'open' | 'onOpenChange'>) => setState(p), dialog };
}
