'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field, FormError, SimpleSelect, SubmitButton, SwitchField } from '@/components/shared/form';
import { COUPON_TYPE } from '@/lib/labels';
import { fromLocalInput, toLocalInput } from '@/lib/format';
import { useSaveCoupon } from '@/lib/queries/orders';
import { couponSchema, type CouponFormValues } from '@/lib/schemas/orders';
import type { Coupon, CouponType } from '@/lib/types';

export function CouponDialog({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const save = useSaveCoupon();
  const form = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: coupon?.code ?? '',
      description: coupon?.description ?? '',
      type: coupon?.type ?? 'PERCENT',
      value: coupon ? String(coupon.value) : '',
      minOrderAmount: coupon?.minOrderAmount != null ? String(coupon.minOrderAmount) : '',
      maxDiscount: coupon?.maxDiscount != null ? String(coupon.maxDiscount) : '',
      usageLimit: coupon?.usageLimit != null ? String(coupon.usageLimit) : '',
      usageLimitPerUser: coupon?.usageLimitPerUser != null ? String(coupon.usageLimitPerUser) : '',
      startsAt: toLocalInput(coupon?.startsAt),
      endsAt: toLocalInput(coupon?.endsAt),
      isActive: coupon?.isActive ?? true,
    },
  });
  const type = form.watch('type');
  const onSubmit = form.handleSubmit(async (raw) => {
    const v = couponSchema.parse(raw);
    await save.mutateAsync({
      id: coupon?.id,
      body: {
        code: v.code,
        description: v.description ?? (coupon ? null : undefined),
        type: v.type,
        value: v.type === 'FREE_SHIPPING' ? 0 : v.value,
        minOrderAmount: v.minOrderAmount ?? null,
        maxDiscount: v.type === 'PERCENT' ? (v.maxDiscount ?? null) : null,
        usageLimit: v.usageLimit ?? null,
        usageLimitPerUser: v.usageLimitPerUser ?? null,
        startsAt: fromLocalInput(v.startsAt),
        endsAt: fromLocalInput(v.endsAt),
        isActive: v.isActive,
      },
    });
    onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{coupon ? `Kupon: ${coupon.code}` : 'Yeni kupon'}</DialogTitle>
          <DialogDescription>Kod ödeme adımında girilir; tutarlar KDV dahildir.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError error={save.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kod" error={form.formState.errors.code} htmlFor="code" required hint="3-32 karakter; otomatik büyük harf">
              <Input id="code" className="font-mono uppercase" maxLength={32} {...form.register('code')} />
            </Field>
            <Field label="Tür" htmlFor="type" required>
              <Controller control={form.control} name="type" render={({ field }) => <SimpleSelect id="type" value={field.value} onChange={field.onChange} options={(Object.keys(COUPON_TYPE) as CouponType[]).map((t) => ({ value: t, label: COUPON_TYPE[t] }))} />} />
            </Field>
            {type !== 'FREE_SHIPPING' && (
              <Field label={type === 'PERCENT' ? 'İndirim (%)' : 'İndirim (₺)'} error={form.formState.errors.value} htmlFor="value" required>
                <Input id="value" type="number" min={0} step={type === 'PERCENT' ? 1 : 0.01} {...form.register('value')} />
              </Field>
            )}
            {type === 'PERCENT' && (
              <Field label="En fazla indirim (₺)" error={form.formState.errors.maxDiscount} htmlFor="maxDiscount">
                <Input id="maxDiscount" type="number" min={0} step="0.01" {...form.register('maxDiscount')} />
              </Field>
            )}
            <Field label="Min. sipariş tutarı (₺)" error={form.formState.errors.minOrderAmount} htmlFor="minOrderAmount">
              <Input id="minOrderAmount" type="number" min={0} step="0.01" {...form.register('minOrderAmount')} />
            </Field>
            <Field label="Toplam kullanım limiti" error={form.formState.errors.usageLimit} htmlFor="usageLimit" hint="Boş = sınırsız">
              <Input id="usageLimit" type="number" min={1} step={1} {...form.register('usageLimit')} />
            </Field>
            <Field label="Kişi başı limit" error={form.formState.errors.usageLimitPerUser} htmlFor="usageLimitPerUser">
              <Input id="usageLimitPerUser" type="number" min={1} step={1} {...form.register('usageLimitPerUser')} />
            </Field>
            <Field label="Başlangıç" error={form.formState.errors.startsAt} htmlFor="startsAt">
              <Input id="startsAt" type="datetime-local" {...form.register('startsAt')} />
            </Field>
            <Field label="Bitiş" error={form.formState.errors.endsAt} htmlFor="endsAt">
              <Input id="endsAt" type="datetime-local" {...form.register('endsAt')} />
            </Field>
            <Field label="Açıklama (iç not)" error={form.formState.errors.description} htmlFor="description" className="sm:col-span-2">
              <Input id="description" maxLength={200} {...form.register('description')} />
            </Field>
          </div>
          <Controller control={form.control} name="isActive" render={({ field }) => <SwitchField label="Aktif" description="Pasif kuponlar ödeme adımında kabul edilmez" checked={field.value} onCheckedChange={field.onChange} />} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <SubmitButton loading={save.isPending}>Kaydet</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
