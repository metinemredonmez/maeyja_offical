import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, map } from 'rxjs';

/** Prisma Decimals serialize as strings by default; clients get plain numbers instead. */
function normalize(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (value instanceof Date || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(normalize);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = normalize(v);
  return out;
}

/** Wraps every successful response as `{ success: true, data }`. */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse();
    return next.handle().pipe(
      map((data) => {
        // Redirects/streams (e.g. payment callback) write their own response.
        if (res.headersSent) return data;
        return { success: true, data: normalize(data ?? null) };
      }),
    );
  }
}
