import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Roles, STAFF_ROLES } from '../../common/decorators/roles.decorator';
import { LOCALES, type Locale } from '../../common/utils/i18n.util';
import { AiService } from './ai.service';

class TranslateDto {
  /** Turkish base texts keyed by field name, e.g. `{ title: '…', body: '<p>…</p>' }`. */
  @IsObject() fields: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(60) kind?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(LOCALES.length) @IsIn(LOCALES, { each: true }) targets?: Locale[];
}

class DraftDto {
  @IsString() @MaxLength(60) kind: string;
  /** What is already written (Turkish), e.g. `{ name: 'Takı' }`. */
  @IsObject() given: Record<string, string>;
  /** Empty fields to draft. */
  @IsArray() @ArrayMaxSize(20) @Matches(/^[a-zA-Z]{1,40}$/, { each: true }) want: string[];
  /** Which of them are HTML. */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) rich?: string[];
  /** Category only: sub-category and product ideas, and a tip. */
  @IsOptional() @IsBoolean() extras?: boolean;
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

  @Post('draft')
  draft(@Body() dto: DraftDto) {
    const given = Object.fromEntries(Object.entries(dto.given).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, v.slice(0, 20_000)]));
    return this.ai.draft({ kind: dto.kind, given, want: dto.want, rich: dto.rich ?? [], extras: Boolean(dto.extras) });
  }
}
