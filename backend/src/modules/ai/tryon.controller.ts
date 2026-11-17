import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { memoryStorage } from 'multer';
import { ClientIp } from '../../common/decorators/client-ip.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { AVATAR_OPTIONS, type AvatarChoice } from './tryon-avatar';
import { TryOnService } from './tryon.service';

class TryOnDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug: string;
  @IsOptional() @IsString() @MaxLength(60) color?: string;
  /** Explicit consent to send the photo abroad for processing, and the 18+ statement — both ticked by the visitor. */
  @IsIn(['true']) consent: string;
  @IsIn(['true']) adult: string;
}

/** No photo, so no consent: only the visitor's choices, each from a fixed list (INP-01). */
export class TryOnAvatarDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug: string;
  @IsOptional() @IsString() @MaxLength(60) color?: string;
  @Type(() => Number) @IsInt() @Min(140) @Max(200) height: number;
  @IsIn(AVATAR_OPTIONS.body) body: AvatarChoice['body'];
  @IsIn(AVATAR_OPTIONS.skin) skin: AvatarChoice['skin'];
  @IsIn(AVATAR_OPTIONS.hair) hair: AvatarChoice['hair'];
  @IsIn(AVATAR_OPTIONS.length) length: AvatarChoice['length'];
}

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@ApiTags('Try-on')
@Public()
@Controller('tryon')
export class TryOnController {
  constructor(private readonly tryon: TryOnService) {}

  @Post()
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1 } }))
  // NET-03: the address from `trust proxy` (nginx and the web proxy), never a raw X-Forwarded-For.
  start(@UploadedFile() photo: Express.Multer.File | undefined, @Body() dto: TryOnDto, @ClientIp() ip: string) {
    if (!photo || !PHOTO_TYPES.includes(photo.mimetype)) throw new BadRequestException('JPEG, PNG ya da WebP fotoğraf yükleyin');
    return this.tryon.start(photo.buffer, dto.slug, dto.color, ip);
  }

  /** A look made before answers at once (`image`); a new one answers with an `id` to poll, like a photo. */
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @HttpCode(200)
  @Post('avatar')
  avatar(@Body() dto: TryOnAvatarDto, @ClientIp() ip: string) {
    const { slug, color, ...choice } = dto;
    return this.tryon.startAvatar(choice, slug, color, ip);
  }

  @Get(':id')
  result(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tryon.result(id);
  }
}

/** AI stüdyo → Deneme avatarları: what visitors were shown; a poor avatar is deleted and made again on demand. */
@ApiTags('Admin · AI')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller('admin/ai/avatars')
export class TryOnAdminController {
  constructor(private readonly tryon: TryOnService) {}

  @Get()
  list() {
    return this.tryon.avatars();
  }

  @Delete('looks')
  removeLooks() {
    return this.tryon.removeLooks();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tryon.removeAvatar(id);
  }
}
