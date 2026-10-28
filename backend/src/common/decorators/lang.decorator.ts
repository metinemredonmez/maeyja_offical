import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DEFAULT_LOCALE, Locale, resolveLocale } from '../utils/i18n.util';

/** Locale from `?lang=` first, then Accept-Language. Falls back to Turkish. */
export const Lang = createParamDecorator((_data: unknown, ctx: ExecutionContext): Locale => {
  const req = ctx.switchToHttp().getRequest();
  return resolveLocale(req.query?.lang ?? req.headers['accept-language'] ?? DEFAULT_LOCALE);
});
