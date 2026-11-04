import { Global, Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { CronTrackerService } from './cron-tracker.service';

/** Scheduled job tracking; the jobs themselves only carry @Tracked. */
@Global()
@Module({
  controllers: [CronController],
  providers: [CronTrackerService],
  exports: [CronTrackerService],
})
export class CronModule {}
