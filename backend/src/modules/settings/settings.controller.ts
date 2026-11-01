import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('settings/public')
  getPublic() {
    return this.settings.getPublic();
  }

  /** Asked by the storefront on every page (cached there for a few seconds). */
  @Public()
  @Get('settings/maintenance')
  maintenance(@Query('preview') preview?: string) {
    return this.settings.maintenance(preview);
  }

  @ApiBearerAuth()
  @Roles(...ADMIN_ROLES)
  @Get('admin/settings')
  getAll() {
    return this.settings.getAll();
  }

  @ApiBearerAuth()
  @Roles(...ADMIN_ROLES)
  @Put('admin/settings/:key')
  update(@Param('key') key: string, @Body() body: Record<string, unknown>) {
    return this.settings.update(key, body);
  }
}
