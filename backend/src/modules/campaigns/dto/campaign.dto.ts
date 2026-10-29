import { PartialType } from '@nestjs/swagger';
import { CampaignAudience } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUrl, Length, Matches, MaxLength, ValidateIf } from 'class-validator';
import { LOCALES } from '../../../common/utils/i18n.util';

/** '' from a cleared form field means "not set". */
const emptyToNull = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? null : value);

export class CampaignDto {
  @IsString() @Length(1, 150) subject: string;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(200) preheader?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(160) title?: string | null;
  @Transform(emptyToNull) @IsOptional() @IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false }) @MaxLength(500) imageUrl?: string | null;
  @IsString() @Length(1, 50000) body: string;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(60) ctaLabel?: string | null;
  // Absolute https link or a storefront path such as /products/origami
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(500) @Matches(/^(https:\/\/|\/)/) ctaUrl?: string | null;
  @IsOptional() @IsEnum(CampaignAudience) audience?: CampaignAudience;
  /** null → every language. */
  @Transform(emptyToNull) @IsOptional() @IsIn(LOCALES as readonly string[]) locale?: string | null;
}

export class UpdateCampaignDto extends PartialType(CampaignDto) {}

export class AudienceQueryDto {
  @IsOptional() @IsEnum(CampaignAudience) audience?: CampaignAudience;
  @Transform(emptyToNull) @IsOptional() @IsIn(LOCALES as readonly string[]) locale?: string | null;
}

export class TestCampaignDto {
  /** Defaults to the signed-in admin's own address. */
  @ValidateIf((o: TestCampaignDto) => o.email !== undefined && o.email !== '') @IsEmail() @MaxLength(160) email?: string;
}

/** `r` = recipient id from the email link, `t` = its signature. */
export class UnsubscribeDto {
  @IsString() @Length(1, 64) r: string;
  @IsString() @Length(16, 64) t: string;
}
