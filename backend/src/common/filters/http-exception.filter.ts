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
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);
      // Machine-readable code (e.g. MFA_SETUP_REQUIRED) — the admin uses it to redirect to MFA setup.
      if (typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string') code = (body as { code: string }).code;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Translate the common Prisma errors into client errors instead of 500s. EXC-01: the Prisma code, column
      // and constraint names stay in the server log; the client only gets the generic sentence.
      const map: Record<string, [number, string]> = {
        P2000: [HttpStatus.BAD_REQUEST, 'Bir alan çok uzun'],
        P2002: [HttpStatus.CONFLICT, 'Bu kayıt zaten mevcut'],
        P2003: [HttpStatus.CONFLICT, 'İlişkili kayıtlar olduğu için işlem yapılamıyor'],
        P2025: [HttpStatus.NOT_FOUND, 'Kayıt bulunamadı'],
      };
      if (map[exception.code]) {
        [status, message] = map[exception.code];
        this.logger.warn(`${req.method} ${req.originalUrl} -> ${status} ${exception.code} ${JSON.stringify(exception.meta ?? {})}`);
      }
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
      ...(code ? { code } : {}),
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
