import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Route is reachable without a token. A valid token is still decoded, so `@CurrentUser()` may be set. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
