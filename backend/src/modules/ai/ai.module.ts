import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { AiAdminController } from './ai-admin.controller';
import { AiService } from './ai.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { TryOnController } from './tryon.controller';
import { TryOnService } from './tryon.service';

@Module({
  imports: [CatalogModule],
  controllers: [AiAdminController, AssistantController, TryOnController],
  providers: [AiService, AssistantService, TryOnService],
  exports: [AiService],
})
export class AiModule {}
