import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Lang } from '../../common/decorators/lang.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Locale } from '../../common/utils/i18n.util';
import { CatalogService } from './catalog.service';
import { ProductQueryDto, StockAlertDto } from './dto/catalog.dto';

@ApiTags('Catalog')
@Public()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories(@Lang() lang: Locale) {
    return this.catalog.categories(lang);
  }

  @Get('collections')
  collections(@Lang() lang: Locale) {
    return this.catalog.collections(lang);
  }

  @Get('collections/:slug')
  collection(@Param('slug') slug: string, @Lang() lang: Locale) {
    return this.catalog.collection(slug, lang);
  }

  @Get('colors')
  colors(@Lang() lang: Locale) {
    return this.catalog.colors(lang);
  }

  @Get('products')
  products(@Query() q: ProductQueryDto, @Lang() lang: Locale) {
    return this.catalog.products(q, lang);
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string, @Lang() lang: Locale) {
    return this.catalog.product(slug, lang);
  }

  /** "Notify me when back in stock". */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('stock-alerts')
  stockAlert(@Body() dto: StockAlertDto) {
    return this.catalog.createStockAlert(dto);
  }
}
