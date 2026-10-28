import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { ReorderDto } from '../../common/dto/reorder.dto';
import { CatalogAdminService } from './catalog-admin.service';
import {
  AdminProductQueryDto,
  CategoryDto,
  CollectionDto,
  ColorDto,
  ImageDto,
  ProductDto,
  StockUpdateDto,
  UpdateCategoryDto,
  UpdateCollectionDto,
  UpdateColorDto,
  UpdateImageDto,
  UpdateProductDto,
  UpdateVariantDto,
  VariantDto,
} from './dto/catalog.dto';

@ApiTags('Admin · Catalog')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@Controller('admin')
export class CatalogAdminController {
  constructor(private readonly admin: CatalogAdminService) {}

  // products
  @Get('products') listProducts(@Query() q: AdminProductQueryDto) { return this.admin.listProducts(q); }
  @Get('products/:id') getProduct(@Param('id') id: string) { return this.admin.getProduct(id); }
  @Post('products') createProduct(@Body() dto: ProductDto) { return this.admin.createProduct(dto); }
  @Patch('products/:id') updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) { return this.admin.updateProduct(id, dto); }
  @Delete('products/:id') deleteProduct(@Param('id') id: string) { return this.admin.deleteProduct(id); }
  @Post('products/:id/duplicate') duplicateProduct(@Param('id') id: string) { return this.admin.duplicateProduct(id); }

  // variants
  @Post('products/:id/variants') addVariant(@Param('id') id: string, @Body() dto: VariantDto) { return this.admin.addVariant(id, dto); }
  @Patch('variants/:id') updateVariant(@Param('id') id: string, @Body() dto: UpdateVariantDto) { return this.admin.updateVariant(id, dto); }
  @Delete('variants/:id') deleteVariant(@Param('id') id: string) { return this.admin.deleteVariant(id); }
  @Patch('variants/:id/stock') updateStock(@Param('id') id: string, @Body() dto: StockUpdateDto) { return this.admin.updateStock(id, dto); }

  // images
  @Post('products/:id/images') addImage(@Param('id') id: string, @Body() dto: ImageDto) { return this.admin.addImage(id, dto); }
  @Put('products/:id/images/order') reorderImages(@Param('id') id: string, @Body() dto: ReorderDto) { return this.admin.reorderImages(id, dto.ids); }
  @Patch('images/:id') updateImage(@Param('id') id: string, @Body() dto: UpdateImageDto) { return this.admin.updateImage(id, dto); }
  @Delete('images/:id') deleteImage(@Param('id') id: string) { return this.admin.deleteImage(id); }

  // categories
  @Get('categories') listCategories() { return this.admin.listCategories(); }
  @Post('categories') createCategory(@Body() dto: CategoryDto) { return this.admin.createCategory(dto); }
  @Patch('categories/:id') updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) { return this.admin.updateCategory(id, dto); }
  @Delete('categories/:id') deleteCategory(@Param('id') id: string) { return this.admin.deleteCategory(id); }

  // collections
  @Get('collections') listCollections() { return this.admin.listCollections(); }
  @Post('collections') createCollection(@Body() dto: CollectionDto) { return this.admin.createCollection(dto); }
  @Patch('collections/:id') updateCollection(@Param('id') id: string, @Body() dto: UpdateCollectionDto) { return this.admin.updateCollection(id, dto); }
  @Delete('collections/:id') deleteCollection(@Param('id') id: string) { return this.admin.deleteCollection(id); }

  // colours
  @Get('colors') listColors() { return this.admin.listColors(); }
  @Post('colors') createColor(@Body() dto: ColorDto) { return this.admin.createColor(dto); }
  @Patch('colors/:id') updateColor(@Param('id') id: string, @Body() dto: UpdateColorDto) { return this.admin.updateColor(id, dto); }
  @Delete('colors/:id') deleteColor(@Param('id') id: string) { return this.admin.deleteColor(id); }
}
