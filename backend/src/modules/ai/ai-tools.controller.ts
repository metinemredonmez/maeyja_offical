import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { ADMIN_ROLES, Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { LOCALES } from '../../common/utils/i18n.util';
import { AiToolsService } from './ai-tools.service';

class AltDto {
  @IsOptional() @IsBoolean() overwrite?: boolean;
}

class CaptionDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(400) note?: string;
}

@ApiTags('Admin · AI araçları')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller('admin/ai')
export class AiToolsController {
  constructor(private readonly tools: AiToolsService) {}

  // AZ-01: the draft reads the inbox and the sender's orders, which only ADMIN may see.
  @Roles(...ADMIN_ROLES)
  @Post('reply/:messageId')
  reply(@Param('messageId') id: string) {
    return this.tools.replyDraft(id);
  }

  @Post('alt/:productId')
  alt(@Param('productId') id: string, @Body() dto: AltDto) {
    return this.tools.altTexts(id, Boolean(dto.overwrite));
  }

  @Post('caption')
  caption(@Body() dto: CaptionDto) {
    return this.tools.caption(dto);
  }

  // AZ-03: revenue and order counts, like the dashboard.
  @Roles(...ADMIN_ROLES)
  @Get('weekly')
  weekly(@Query('refresh') refresh?: string) {
    return this.tools.weekly(refresh === '1');
  }
}

/** The shop's plain-language search ("omuzda taşınan siyah küçük çanta"). */
@ApiTags('AI arama')
@Controller('ai')
export class AiSearchController {
  constructor(private readonly tools: AiToolsService) {}

  @Public()
  // Pages are rendered by the storefront server, so its own address counts for many visitors; results are cached.
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Get('search')
  search(@Query('q') q = '', @Query('locale') locale = 'tr') {
    return this.tools.search(String(q), (LOCALES as readonly string[]).includes(locale) ? locale : 'tr');
  }
}
