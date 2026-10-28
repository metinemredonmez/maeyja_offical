'use client';

import { AlertTriangleIcon, InboxIcon, LockIcon, RefreshCwIcon, WifiOffIcon } from 'lucide-react';
import { ApiError, errorMessage, MFA_SETUP_PATH } from '@/lib/api.client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function EmptyState({ title = 'Kayıt yok', description, action, icon, className }: { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center', className)}>
      <span className="text-muted-foreground">{icon ?? <InboxIcon className="size-6" />}</span>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const api = error instanceof ApiError ? error : null;
  const forbidden = api?.isForbidden;
  const network = api?.isNetwork;
  const mfa = api?.code === 'MFA_SETUP_REQUIRED';
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border px-6 py-12 text-center', forbidden ? 'border-amber-200 bg-amber-50/40' : 'border-rose-200 bg-rose-50/40', className)}>
      <span className={forbidden ? 'text-amber-700' : 'text-rose-700'}>{forbidden ? <LockIcon className="size-6" /> : network ? <WifiOffIcon className="size-6" /> : <AlertTriangleIcon className="size-6" />}</span>
      <p className="text-sm font-medium">{mfa ? 'Önce iki adımlı doğrulamayı kurun' : forbidden ? 'Bu sayfa için yetkiniz yok' : network ? 'Sunucuya ulaşılamıyor' : 'Bir hata oluştu'}</p>
      <p className="max-w-md text-xs text-muted-foreground">
        {mfa ? (
          <>
            Yönetim sayfaları için authenticator uygulamasıyla doğrulama zorunlu. <a href={MFA_SETUP_PATH} className="underline">Profil → İki adımlı doğrulama</a>
          </>
        ) : forbidden ? (
          'Gerekli rol: yönetici. Yetki almak için süper admin ile görüşün.'
        ) : (
          errorMessage(error)
        )}
      </p>
      {onRetry && !forbidden && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCwIcon /> Tekrar dene
        </Button>
      )}
    </div>
  );
}

export function LoadingBlock({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-label="Yükleniyor">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

type QueryLike<T> = { data: T | undefined; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };

/** Renders loading / error / content for a react-query result. */
export function QueryState<T>({ query, children, loading, className }: { query: QueryLike<T>; children: (data: T) => React.ReactNode; loading?: React.ReactNode; className?: string }) {
  if (query.isPending) return <>{loading ?? <LoadingBlock className={className} />}</>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} className={className} />;
  if (query.data === undefined) return null;
  return <>{children(query.data)}</>;
}
