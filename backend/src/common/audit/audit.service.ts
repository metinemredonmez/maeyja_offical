import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/** LOG-02: keys whose values never reach the audit log, at any depth. */
const SENSITIVE = /password|passwd|token|secret|api[-_]?key|private[-_]?key|authorization|cookie|cvc|cvv|card[-_]?number|webhook[-_]?url/i;
const MAX_DEPTH = 6;

export function redact(value: unknown, depth = 0): unknown {
  if (!value || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '…';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? '***' : redact(v, depth + 1)]));
}

type WithId = Request & { id?: string };

/** LOG-01: one id per request (nginx's `X-Request-Id` when it looks like one), echoed back and put in logs. */
export function requestIdMiddleware(req: WithId, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  req.id = typeof incoming === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

export const requestId = (req: unknown) => (req as WithId | undefined)?.id;

export interface AuditEntry {
  outcome: 'ok' | 'denied' | 'failed';
  status?: number;
  entityId?: string | null;
}

/**
 * Admin writes, exports and refusals go to the AuditLog table. LOG-01: a write has already happened when its
 * entry fails to save, so the request isn't undone; the miss is logged as an error (with the request id) instead.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  record(req: Request & { user?: { id?: string } }, entry: AuditEntry) {
    const path = (req.route?.path as string | undefined) ?? req.originalUrl.split('?')[0];
    const [, entity, param] = path.match(/admin\/([^/]+)(?:\/:([^/]+))?/) ?? [];
    const action = `${req.method} ${path}`;
    const body = req.body && typeof req.body === 'object' && Object.keys(req.body).length ? (redact(req.body) as object) : undefined;
    const meta = { outcome: entry.outcome, ...(entry.status ? { status: entry.status } : {}), requestId: requestId(req), ...(body ? { body } : {}) };
    void this.prisma.auditLog
      .create({ data: { actorId: req.user?.id, action, entity, entityId: param ? String(req.params?.[param] ?? '') || null : (entry.entityId ?? null), meta, ip: req.ip } })
      .catch((e: Error) => this.logger.error(`audit entry lost (${action}, request ${requestId(req)}): ${e.message}`));
  }
}
