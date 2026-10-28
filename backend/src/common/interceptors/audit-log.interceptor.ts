import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

const SENSITIVE = /password|token|secret|apiKey/i;

function redact(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? '***' : v]),
  );
}

/** Records every successful write made through /admin routes. */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const isAdminWrite = req.method !== 'GET' && req.originalUrl?.includes('/admin/');
    if (!isAdminWrite) return next.handle();

    return next.handle().pipe(
      tap((result: unknown) => {
        const [, entity, entityId] = (req.route?.path as string | undefined)?.match(/admin\/([^/]+)(?:\/:([^/]+))?/) ?? [];
        this.prisma.auditLog
          .create({
            data: {
              actorId: req.user?.id,
              action: `${req.method} ${req.route?.path ?? req.originalUrl}`,
              entity,
              entityId: entityId ? req.params?.[entityId] : ((result as { id?: string } | undefined)?.id ?? null),
              meta: req.body && Object.keys(req.body).length ? (redact(req.body) as object) : undefined,
              ip: req.ip,
            },
          })
          .catch((e) => this.logger.warn(`audit log failed: ${e.message}`));
      }),
    );
  }
}
