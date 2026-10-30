import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ContentAdminController } from './content-admin.controller';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { InstagramService } from './instagram.service';

@Module({
  imports: [CatalogModule],
  controllers: [ContentController, ContentAdminController],
  providers: [ContentService, InstagramService],
})
export class ContentModule {}
