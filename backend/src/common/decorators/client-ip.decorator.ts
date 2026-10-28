import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Real client IP — relies on `trust proxy` being set in main.ts when running behind nginx. */
export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return (req.ip || req.socket?.remoteAddress || '127.0.0.1').replace('::ffff:', '');
});
