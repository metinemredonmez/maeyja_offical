import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { WishlistController } from './wishlist.controller';

@Module({ imports: [CatalogModule], controllers: [WishlistController] })
export class WishlistModule {}
