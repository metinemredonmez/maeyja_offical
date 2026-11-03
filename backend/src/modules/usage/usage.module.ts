import { Global, Module } from '@nestjs/common';
import { UsageService } from './usage.service';

/** Persistent use counters (AI quotas, e-mails per address), shared by every module. */
@Global()
@Module({
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
