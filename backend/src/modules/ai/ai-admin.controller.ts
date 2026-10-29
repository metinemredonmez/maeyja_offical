import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { LOCALES, type Locale } from '../../common/utils/i18n.util';
import { AiService } from './ai.service';

class TranslateDto {
  /** Turkish base texts keyed by field name, e.g. `{ title: '…', body: '<p>…</p>' }`. */
  @IsObject() fields: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(60) kind?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(LOCALES.length) @IsIn(LOCALES, { each: true }) targets?: Locale[];
}

@ApiTags('Admin · AI')
@ApiBearerAuth()
@Roles(...STAFF_ROLES)
@Controller('admin/ai')
export class AiAdminController {
  constructor(private readonly ai: AiService) {}

  @Post('translate')
  async translate(@Body() dto: TranslateDto) {
    const fields = Object.fromEntries(Object.entries(dto.fields).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v.slice(0, 60_000)]));
    return { translations: await this.ai.translate(fields, dto.kind ?? 'store content', dto.targets) };
  }
}
