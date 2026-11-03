import { Global, Module } from '@nestjs/common';
import { SessionStateService } from './session-state.service';

/** Session liveness for the global JWT guard and every place that has to end sessions. */
@Global()
@Module({
  providers: [SessionStateService],
  exports: [SessionStateService],
})
export class SessionModule {}
