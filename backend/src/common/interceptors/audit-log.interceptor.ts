import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../audit/audit.service';

/** Records every write made through /admin routes, every admin export, and the ones that failed (LOG-01). */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const admin = req.originalUrl?.includes('/admin/');
    const isExport = req.method === 'GET' && /export/i.test(req.originalUrl ?? '');
    if (!admin || (req.method === 'GET' && !isExport)) return next.handle();

    return next.handle().pipe(
      tap({
        next: (result: unknown) => this.audit.record(req, { outcome: 'ok', entityId: (result as { id?: string } | undefined)?.id }),
        error: (e: unknown) => {
          const status = e instanceof HttpException ? e.getStatus() : 500;
          // Refusals (403) are recorded by the exception filter, which also sees the ones a guard made.
          if (status !== 403) this.audit.record(req, { outcome: 'failed', status });
        },
      }),
    );
  }
}
