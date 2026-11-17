import { Body, Controller, Delete, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { AdsService, Range, RANGES } from './ads.service';
import { MetaAdsClient } from './meta-ads.client';

class ConnectDto {
  /** Audit-logged redacted (the field name has "token"). */
  @IsString() @MaxLength(700) accessToken: string;
  @IsString() @MaxLength(40) adAccountId: string;
}

class OverviewQueryDto {
  @ApiPropertyOptional({ enum: Object.keys(RANGES) })
  @IsOptional()
  @IsIn(Object.keys(RANGES))
  range?: Range;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  fresh?: boolean;
}

/** Admin → Reklamlar. Spend and revenue are for admins only. */
@ApiTags('Admin · Ads')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@Controller('admin/ads')
export class AdsController {
  constructor(
    private readonly ads: AdsService,
    private readonly meta: MetaAdsClient,
  ) {}

  @Get('connection')
  status() {
    return this.meta.status();
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Put('connection')
  async connect(@Body() dto: ConnectDto) {
    const status = await this.meta.connect(dto.accessToken, dto.adAccountId);
    this.ads.clearCache();
    return status;
  }

  @Delete('connection')
  async disconnect() {
    this.ads.clearCache();
    return this.meta.disconnect();
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('overview')
  overview(@Query() q: OverviewQueryDto) {
    return this.ads.overview(q.range ?? '30d', q.fresh);
  }
}
