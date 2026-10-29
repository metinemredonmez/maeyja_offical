import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Lang } from '../../common/decorators/lang.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Locale } from '../../common/utils/i18n.util';
import { ContentService } from './content.service';
import { ContactDto, SubscribeDto } from './dto/content.dto';

@ApiTags('Content')
@Public()
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('content/home') home(@Lang() lang: Locale) { return this.content.home(lang); }
  @Get('content/pages/:slug') page(@Param('slug') slug: string, @Lang() lang: Locale) { return this.content.page(slug, lang); }
  @Get('content/journal') journal(@Query() q: PaginationQueryDto, @Lang() lang: Locale) { return this.content.journal(q, lang); }
  @Get('content/journal/:slug') journalPost(@Param('slug') slug: string, @Lang() lang: Locale) { return this.content.journalPost(slug, lang); }
  @Get('content/press') press(@Lang() lang: Locale) { return this.content.press(lang); }
  @Get('content/stockists') stockists(@Lang() lang: Locale) { return this.content.stockists(lang); }
  @Get('content/faq') faq(@Lang() lang: Locale) { return this.content.faq(lang); }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('newsletter/subscribe')
  subscribe(@Body() dto: SubscribeDto) { return this.content.subscribe(dto); }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('contact')
  contact(@Body() dto: ContactDto) { return this.content.contact(dto); }
}
