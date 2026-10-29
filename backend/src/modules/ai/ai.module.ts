import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { AiAdminController } from './ai-admin.controller';
import { AiService } from './ai.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [CatalogModule],
  controllers: [AiAdminController, AssistantController],
  providers: [AiService, AssistantService],
  exports: [AiService],
})
export class AiModule {}
