import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CampaignsService } from './campaigns.service';
import { AudienceQueryDto, CampaignDto, TestCampaignDto, UnsubscribeDto, UpdateCampaignDto } from './dto/campaign.dto';

@ApiTags('Campaigns')
@Controller()
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  // ───────── admin ─────────
  @ApiBearerAuth() @Roles(...ADMIN_ROLES) @Get('admin/campaigns')
  list(@Query() q: PaginationQueryDto) { return this.campaigns.list(q); }

  @ApiBearerAuth() @Roles(...ADMIN_ROLES) @Get('admin/campaigns/audience')
  audience(@Query() q: AudienceQueryDto) { return this.campaigns.audienceCount(q); }

  @ApiBearerAuth() @Roles(...ADMIN_ROLES) @Get('admin/campaigns/:id')
  get(@Param('id') id: string) { return this.campaigns.get(id); }

  @ApiBearerAuth() @Roles(...ADMIN_ROLES) @Post('admin/campaigns')
  create(@Body() dto: CampaignDto, @CurrentUser() user: AuthUser) { return this.campaigns.create(dto, user.id); }

  @ApiBearerAuth() @Roles(...ADMIN_ROLES) @Patch('admin/campaigns/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) { return this.campaigns.update(id, dto); }

  @ApiBearerAuth() @Roles(...ADMIN_ROLES) @Delete('admin/campaigns/:id')
  remove(@Param('id') id: string) { return this.campaigns.remove(id); }

  @ApiBearerAuth() @Roles(...ADMIN_ROLES) @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post('admin/campaigns/:id/test')
  test(@Param('id') id: string, @Body() dto: TestCampaignDto, @CurrentUser() user: AuthUser) { return this.campaigns.sendTest(id, dto.email || user.email); }

  @ApiBearerAuth() @Roles(...ADMIN_ROLES) @HttpCode(200) @Post('admin/campaigns/:id/send')
  send(@Param('id') id: string) { return this.campaigns.send(id); }

  @ApiBearerAuth() @Roles(...ADMIN_ROLES) @HttpCode(200) @Post('admin/campaigns/:id/cancel')
  cancel(@Param('id') id: string) { return this.campaigns.cancel(id); }

  // ───────── public: unsubscribe from the link in the email ─────────
  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post('newsletter/unsubscribe')
  unsubscribe(@Body() dto: UnsubscribeDto) { return this.campaigns.unsubscribe(dto.r, dto.t); }

  /** RFC 8058: mail clients POST here when the reader clicks "Unsubscribe" next to the sender. */
  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @HttpCode(200) @Post('newsletter/unsubscribe/one-click')
  oneClick(@Query() q: UnsubscribeDto) { return this.campaigns.unsubscribe(q.r, q.t); }
}
