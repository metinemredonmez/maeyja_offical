import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { AiStudioController } from './ai-studio.controller';
import { AiStudioService } from './ai-studio.service';
import { AiAdminController } from './ai-admin.controller';
import { AiSearchController, AiToolsController } from './ai-tools.controller';
import { AiToolsService } from './ai-tools.service';
import { AiService } from './ai.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { TryOnController } from './tryon.controller';
import { TryOnService } from './tryon.service';

@Module({
  imports: [CatalogModule],
  controllers: [AiAdminController, AiToolsController, AiSearchController, AiStudioController, AssistantController, TryOnController],
  providers: [AiService, AiToolsService, AiStudioService, AssistantService, TryOnService],
  exports: [AiService],
})
export class AiModule {}
