'use client';

import { Suspense } from 'react';
import { DataTable, type Column } from '@/components/shared/data-table';
import { SimpleSelect } from '@/components/shared/form';
import { PageHeader } from '@/components/shared/page-header';
import { DateTime } from '@/components/shared/primitives';
import { StatusBadge, ToneBadge } from '@/components/shared/status-badge';
import { useListParams } from '@/hooks/use-list-params';
import { USER_ROLE } from '@/lib/labels';
import { fullName } from '@/lib/format';
import { useUsers } from '@/lib/queries/users';
import type { AdminUserRow, UserRole } from '@/lib/types';

function CustomersList() {
  const { params, set, page, limit } = useListParams({ q: '', role: 'CUSTOMER' });
  const query = useUsers({ page, limit, q: params.q || undefined, role: (params.role as UserRole) || undefined });

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'name',
      header: 'Müşteri',
      cell: (u) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{fullName(u)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {u.email}
            {u.phone ? ` · ${u.phone}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'role', header: 'Rol', cell: (u) => <ToneBadge tone={u.role === 'CUSTOMER' ? 'neutral' : 'info'}>{USER_ROLE[u.role]}</ToneBadge> },
    { key: 'orders', header: 'Sipariş', align: 'right', cell: (u) => <span className="tabular-nums">{u.orderCount}</span> },
    { key: 'status', header: 'Durum', cell: (u) => <StatusBadge kind="active" value={u.isActive} /> },
    { key: 'verified', header: 'E-posta', cell: (u) => <span className="text-xs text-muted-foreground">{u.emailVerified ? 'doğrulandı' : 'doğrulanmadı'}</span> },
    { key: 'last', header: 'Son giriş', align: 'right', cell: (u) => <DateTime value={u.lastLoginAt} mode="relative" className="text-xs text-muted-foreground" /> },
    { key: 'created', header: 'Kayıt', align: 'right', cell: (u) => <DateTime value={u.createdAt} mode="date" className="text-xs text-muted-foreground" /> },
  ];

  return (
    <>
      <PageHeader title="Müşteriler" description={query.data ? `${query.data.total} kullanıcı` : undefined} />
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(u) => u.id}
        rowHref={(u) => `/customers/${u.id}`}
        total={query.data?.total}
        page={page}
        limit={limit}
        onPageChange={(p) => set({ page: p })}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        emptyTitle="Kullanıcı bulunamadı"
        search={{ value: params.q, onChange: (q) => set({ q }), placeholder: 'E-posta, ad, telefon…' }}
        toolbar={<SimpleSelect value={params.role} onChange={(v) => set({ role: v })} allowEmpty emptyLabel="Tüm roller" className="w-40" options={(Object.keys(USER_ROLE) as UserRole[]).map((r) => ({ value: r, label: USER_ROLE[r] }))} ariaLabel="Rol filtresi" />}
      />
    </>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={null}>
      <CustomersList />
    </Suspense>
  );
}
