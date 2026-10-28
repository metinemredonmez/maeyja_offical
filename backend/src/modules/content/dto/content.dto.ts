import { PartialType } from '@nestjs/swagger';
import { ContentStatus, HomeSectionType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEmail, IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { LOCALES, Locale } from '../../../common/utils/i18n.util';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class HomeSectionDto {
  @IsEnum(HomeSectionType) type: HomeSectionType;
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(300) subtitle?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() mobileImageUrl?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @IsString() @MaxLength(60) ctaLabel?: string;
  @IsOptional() @IsString() @MaxLength(300) ctaUrl?: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsObject() translations?: Record<string, Record<string, string>>;
}
export class UpdateHomeSectionDto extends PartialType(HomeSectionDto) {}

export class PageDto {
  @Matches(SLUG) slug: string;
  @IsString() @MaxLength(160) title: string;
  @IsString() body: string;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
  @IsOptional() @IsObject() translations?: Record<string, Record<string, string>>;
  @IsOptional() @IsString() @MaxLength(160) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(320) seoDescription?: string;
}
export class UpdatePageDto extends PartialType(PageDto) {}

export class JournalPostDto {
  @IsString() @MaxLength(160) title: string;
  @IsOptional() @Matches(SLUG) slug?: string;
  @IsOptional() @IsString() @MaxLength(400) excerpt?: string;
  @IsString() body: string;
  @IsOptional() @IsString() coverImageUrl?: string;
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
  @IsOptional() @Type(() => Date) @IsDate() publishedAt?: Date;
  @IsOptional() @IsObject() translations?: Record<string, Record<string, string>>;
  @IsOptional() @IsString() @MaxLength(160) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(320) seoDescription?: string;
}
export class UpdateJournalPostDto extends PartialType(JournalPostDto) {}

export class PressItemDto {
  @IsString() @MaxLength(80) publication: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(400) quote?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @Type(() => Date) @IsDate() publishedAt?: Date;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdatePressItemDto extends PartialType(PressItemDto) {}

export class StockistDto {
  @IsString() @MaxLength(120) name: string;
  @IsString() @MaxLength(60) city: string;
  @IsOptional() @IsString() @Length(2, 2) country?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() mapUrl?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateStockistDto extends PartialType(StockistDto) {}

export class FaqDto {
  @IsOptional() @IsString() @MaxLength(60) group?: string;
  @IsString() @MaxLength(300) question: string;
  @IsString() answer: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsObject() translations?: Record<string, Record<string, string>>;
}
export class UpdateFaqDto extends PartialType(FaqDto) {}

export class SubscribeDto {
  @Transform(lower) @IsEmail() @MaxLength(160) email: string;
  @IsOptional() @IsIn(LOCALES as readonly string[]) locale?: Locale;
  @IsOptional() @IsString() @MaxLength(40) source?: string;
}

export class ContactDto {
  @IsString() @Length(2, 100) name: string;
  @Transform(lower) @IsEmail() email: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(160) subject?: string;
  @IsString() @Length(5, 4000) message: string;
  /** Honeypot: real users leave this empty. */
  @IsOptional() @IsString() website?: string;
}

export class ContentListQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(ContentStatus) status?: ContentStatus;
}
