'use client';

import { useId } from 'react';
import type { FieldError } from 'react-hook-form';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api.client';
import { cn } from '@/lib/utils';

export function Field({
  label,
  error,
  hint,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: React.ReactNode;
  error?: FieldError | { message?: string } | string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const msg = typeof error === 'string' ? error : error?.message;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground/80">
          {label}
          {required && <span className="text-[#A3121B]"> *</span>}
        </Label>
      )}
      {children}
      {msg ? <p className="text-xs text-rose-700">{msg}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Shows backend `message` (string or string[]) above the form. */
export function FormError({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const messages = error instanceof ApiError ? error.messages : [error instanceof Error ? error.message : String(error)];
  return (
    <div role="alert" className={cn('flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800', className)}>
      <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
      <ul className="space-y-0.5">
        {messages.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

export type Option = { value: string; label: React.ReactNode; disabled?: boolean };

/** Controlled select built on base-ui; `''` means "none" (shown as placeholder). */
export function SimpleSelect({
  value,
  onChange,
  options,
  placeholder = 'Seçin',
  allowEmpty,
  emptyLabel = '— Yok —',
  className,
  disabled,
  size,
  id,
  ariaLabel,
}: {
  value: string | undefined | null;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'default';
  id?: string;
  ariaLabel?: string;
}) {
  const items = [...(allowEmpty ? [{ value: '', label: emptyLabel }] : []), ...options];
  const labels: Record<string, React.ReactNode> = Object.fromEntries(items.map((o) => [o.value, o.label]));
  const current = value ?? '';
  return (
    <Select value={current} onValueChange={(v) => onChange((v as string | null) ?? '')} disabled={disabled}>
      <SelectTrigger id={id} size={size} className={cn('w-full', className)} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder}>{(v: unknown) => (v === '' || v === null || v === undefined ? <span className="text-muted-foreground">{allowEmpty && current === '' ? emptyLabel : placeholder}</span> : labels[String(v)] ?? String(v))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value || '__empty'} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SwitchField({ label, description, checked, onCheckedChange, disabled, className }: { label: React.ReactNode; description?: React.ReactNode; checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; className?: string }) {
  const id = useId();
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-lg border px-3 py-2', className)}>
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export function SubmitButton({ loading, children, className, disabled, ...rest }: React.ComponentProps<typeof Button> & { loading?: boolean }) {
  return (
    <Button type="submit" disabled={loading || disabled} className={className} {...rest}>
      {loading && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  );
}

export const inputClass = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50';
