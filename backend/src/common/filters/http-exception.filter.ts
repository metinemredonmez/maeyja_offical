import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Beklenmeyen bir hata oluştu';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Translate the common Prisma errors into client errors instead of 500s.
      const map: Record<string, [number, string]> = {
        P2002: [HttpStatus.CONFLICT, 'Bu kayıt zaten mevcut'],
        P2003: [HttpStatus.CONFLICT, 'İlişkili kayıtlar olduğu için işlem yapılamıyor'],
        P2025: [HttpStatus.NOT_FOUND, 'Kayıt bulunamadı'],
      };
      [status, message] = map[exception.code] ?? [HttpStatus.BAD_REQUEST, `Veritabanı hatası (${exception.code})`];
      details = { code: exception.code, target: exception.meta?.target };
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} -> ${status}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(details ? { details } : {}),
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
