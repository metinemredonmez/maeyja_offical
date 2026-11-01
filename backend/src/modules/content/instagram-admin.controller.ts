import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { InstagramService } from './instagram.service';

class PublishDto {
  /** One of this site's uploads. */
  @IsString() @MaxLength(500) imageUrl: string;
  @IsString() @MaxLength(2200) caption: string;
}

/** "Instagram'da yayınla" in the admin: the shop's own account (the same connection as the home page feed). */
@ApiTags('Admin · Instagram')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller('admin/instagram')
export class InstagramAdminController {
  constructor(private readonly instagram: InstagramService) {}

  @Get('status')
  status() {
    return this.instagram.account();
  }

  @Post('publish')
  publish(@Body() dto: PublishDto) {
    return this.instagram.publish(dto.imageUrl, dto.caption);
  }
}
