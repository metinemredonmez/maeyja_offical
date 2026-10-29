import { Module } from '@nestjs/common';
import { AiAdminController } from './ai-admin.controller';
import { AiService } from './ai.service';

@Module({
  controllers: [AiAdminController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
