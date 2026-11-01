import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { AiStudioService, CARRY, type Carry, STUDIO_KINDS, type StudioKind } from './ai-studio.service';

class StudioDto {
  @IsIn(STUDIO_KINDS) kind: StudioKind;
  /** One of this site's uploads (a product photo, a homepage image…). */
  @IsString() @MaxLength(500) imageUrl: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsIn(CARRY) carry?: Carry;
  @IsOptional() @IsString() @MaxLength(400) note?: string;
}

class AddDto {
  @IsOptional() @IsString() productId?: string;
}

@ApiTags('Admin · AI stüdyo')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller('admin/ai/studio')
export class AiStudioController {
  constructor(private readonly studio: AiStudioService) {}

  @Post()
  start(@Body() dto: StudioDto) {
    return this.studio.start(dto);
  }

  @Get('jobs/:id')
  job(@Param('id') id: string) {
    return this.studio.status(id);
  }

  @Get('suggestions')
  suggestions(@Query('productId') productId?: string, @Query('status') status?: string) {
    return this.studio.suggestions(productId, status);
  }

  @Post('suggestions/:id/product')
  addToProduct(@Param('id') id: string, @Body() dto: AddDto) {
    return this.studio.addToProduct(id, dto.productId);
  }

  @Post('suggestions/:id/banner')
  addAsBanner(@Param('id') id: string) {
    return this.studio.addAsBanner(id);
  }

  @Post('suggestions/:id/used')
  markUsed(@Param('id') id: string) {
    return this.studio.markUsed(id);
  }

  @Delete('suggestions/:id')
  dismiss(@Param('id') id: string) {
    return this.studio.dismiss(id);
  }
}
