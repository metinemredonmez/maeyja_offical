import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { MediaService } from './media.service';

class AltDto {
  @IsOptional() @IsString() @MaxLength(200) alt?: string;
}

const MAX_MB = Number(process.env.UPLOAD_MAX_MB ?? 15);

@ApiTags('Admin · Media')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller('admin/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, alt: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 } }))
  upload(@UploadedFile() file: Express.Multer.File, @Body() body: AltDto, @CurrentUser() user: AuthUser) {
    return this.media.upload(file, body.alt, user.id);
  }

  @Get()
  list(@Query() q: PaginationQueryDto) {
    return this.media.list(q);
  }

  @Patch(':id')
  updateAlt(@Param('id') id: string, @Body() body: AltDto) {
    return this.media.updateAlt(id, body.alt ?? '');
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.media.remove(id);
  }
}
