'use client';

import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Field, FormError, SimpleSelect, SubmitButton } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime } from '@/components/shared/primitives';
import { ErrorState } from '@/components/shared/query-state';
import { ToneBadge } from '@/components/shared/status-badge';
import { STAFF_ROLES, USER_ROLE } from '@/lib/labels';
import { fullName } from '@/lib/format';
import { useMe } from '@/lib/queries/auth';
import { useCreateStaff, useUpdateUser, useUsers } from '@/lib/queries/users';
import { createStaffSchema, type CreateStaffValues } from '@/lib/schemas/auth';
import type { AdminUserRow, UserRole } from '@/lib/types';

const ROLE_OPTIONS = STAFF_ROLES.map((r) => ({ value: r, label: USER_ROLE[r] }));

function CreateStaffDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateStaff();
  const form = useForm<CreateStaffValues>({ resolver: zodResolver(createStaffSchema), defaultValues: { email: '', password: '', firstName: '', lastName: '', role: 'EDITOR' } });
  const onSubmit = form.handleSubmit(async (v) => {
    await create.mutateAsync(v);
    onClose();
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni personel</DialogTitle>
          <DialogDescription>Editör yalnızca içerik ve medyayı; yönetici personel dışında her şeyi yönetir.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError error={create.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ad" error={form.formState.errors.firstName} htmlFor="firstName" required>
              <Input id="firstName" autoComplete="off" {...form.register('firstName')} />
            </Field>
            <Field label="Soyad" error={form.formState.errors.lastName} htmlFor="lastName" required>
              <Input id="lastName" autoComplete="off" {...form.register('lastName')} />
            </Field>
            <Field label="E-posta" error={form.formState.errors.email} htmlFor="email" required className="sm:col-span-2">
              <Input id="email" type="email" autoComplete="off" {...form.register('email')} />
            </Field>
            <Field label="Geçici şifre" error={form.formState.errors.password} htmlFor="password" required hint="En az 8 karakter, harf ve rakam; ilk girişte değiştirmesini isteyin">
              <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
            </Field>
            <Field label="Rol" htmlFor="role" required>
              <Controller control={form.control} name="role" render={({ field }) => <SimpleSelect id="role" value={field.value} onChange={(v) => field.onChange(v as UserRole)} options={ROLE_OPTIONS} />} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <SubmitButton loading={create.isPending}>Oluştur</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function StaffPage() {
  const me = useMe();
  const editors = useUsers({ page: 1, limit: 100, role: 'EDITOR' });
  const admins = useUsers({ page: 1, limit: 100, role: 'ADMIN' });
  const supers = useUsers({ page: 1, limit: 100, role: 'SUPER_ADMIN' });
  const update = useUpdateUser();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const all = [...(supers.data?.items ?? []), ...(admins.data?.items ?? []), ...(editors.data?.items ?? [])];
    return all.sort((a, b) => STAFF_ROLES.indexOf(b.role) - STAFF_ROLES.indexOf(a.role) || a.email.localeCompare(b.email));
  }, [editors.data, admins.data, supers.data]);
  const isLoading = editors.isPending || admins.isPending || supers.isPending;
  const error = editors.error ?? admins.error ?? supers.error;
  const retry = () => {
    editors.refetch();
    admins.refetch();
    supers.refetch();
  };

  if (me.data && me.data.role !== 'SUPER_ADMIN') return <ErrorState error={Object.assign(new Error('Bu sayfa yalnızca süper admin içindir'), { statusCode: 403 })} />;

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'name',
      header: 'Personel',
      cell: (u) => (
        <div>
          <p className="font-medium">
            {fullName(u)} {u.id === me.data?.id && <ToneBadge tone="neutral">siz</ToneBadge>}
          </p>
          <p className="text-xs text-muted-foreground">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol',
      cell: (u) => (
        <div className="w-40" data-no-row-link>
          <SimpleSelect
            value={u.role}
            size="sm"
            disabled={u.id === me.data?.id || update.isPending}
            options={ROLE_OPTIONS}
            ariaLabel="Rol"
            onChange={(v) =>
              confirm.ask({
                title: `${fullName(u)} → ${USER_ROLE[v as UserRole]}`,
                description: 'Rol değişince kullanıcının açık oturumları kapatılır; yeni yetkiler sonraki girişte geçerli olur.',
                confirmLabel: 'Değiştir',
                onConfirm: () => update.mutateAsync({ id: u.id, body: { role: v as UserRole } }),
              })
            }
          />
        </div>
      ),
    },
    {
      key: 'active',
      header: 'Aktif',
      cell: (u) => (
        <Switch
          checked={u.isActive}
          disabled={u.id === me.data?.id || update.isPending}
          aria-label="Aktif"
          onCheckedChange={(v) =>
            confirm.ask({
              title: v ? 'Hesap aktifleştirilsin mi?' : 'Hesap pasife alınsın mı?',
              description: v ? `${u.email} yeniden giriş yapabilir.` : `${u.email} giriş yapamaz; açık oturumları kapatılır.`,
              confirmLabel: v ? 'Aktifleştir' : 'Pasife al',
              destructive: !v,
              onConfirm: () => update.mutateAsync({ id: u.id, body: { isActive: v } }),
            })
          }
        />
      ),
    },
    { key: 'last', header: 'Son giriş', align: 'right', cell: (u) => <DateTime value={u.lastLoginAt} mode="relative" className="text-xs text-muted-foreground" /> },
    { key: 'created', header: 'Oluşturuldu', align: 'right', cell: (u) => <DateTime value={u.createdAt} mode="date" className="text-xs text-muted-foreground" /> },
  ];

  return (
    <>
      <PageHeader
        title="Personel"
        description="Editör, yönetici ve süper admin hesapları."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon /> Yeni personel
          </Button>
        }
      />
      <DataTable columns={columns} rows={isLoading ? undefined : rows} rowKey={(u) => u.id} isLoading={isLoading} error={error} onRetry={retry} emptyTitle="Personel yok" />
      {creating && <CreateStaffDialog onClose={() => setCreating(false)} />}
      {confirm.dialog}
    </>
  );
}
