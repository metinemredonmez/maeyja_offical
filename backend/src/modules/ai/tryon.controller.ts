import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Request } from 'express';
import { memoryStorage } from 'multer';
import { Public } from '../../common/decorators/public.decorator';
import { TryOnService } from './tryon.service';

class TryOnDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug: string;
  @IsOptional() @IsString() @MaxLength(60) color?: string;
  /** Explicit consent to send the photo abroad for processing, and the 18+ statement — both ticked by the visitor. */
  @IsIn(['true']) consent: string;
  @IsIn(['true']) adult: string;
}

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@ApiTags('Try-on')
@Public()
@Controller('tryon')
export class TryOnController {
  constructor(private readonly tryon: TryOnService) {}

  @Post()
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1 } }))
  start(@UploadedFile() photo: Express.Multer.File | undefined, @Body() dto: TryOnDto, @Req() req: Request) {
    if (!photo || !PHOTO_TYPES.includes(photo.mimetype)) throw new BadRequestException('JPEG, PNG ya da WebP fotoğraf yükleyin');
    const visitor = String(req.headers['x-forwarded-for'] ?? req.ip ?? 'unknown').split(',')[0].trim();
    return this.tryon.start(photo.buffer, dto.slug, dto.color, visitor);
  }

  @Get(':id')
  result(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tryon.result(id);
  }
}
