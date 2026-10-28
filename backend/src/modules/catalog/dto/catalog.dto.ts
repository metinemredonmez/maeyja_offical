import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LOCALES, Locale } from '../../../common/utils/i18n.util';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const toBool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);
const toNum = ({ value }: { value: unknown }) => (value === '' || value === undefined ? undefined : Number(value));

// ─────────── storefront queries ───────────

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() collection?: string;
  @ApiPropertyOptional({ description: 'Colour slug(s), comma separated' }) @IsOptional() @IsString() color?: string;
  @ApiPropertyOptional({ description: 'Size(s), comma separated' }) @IsOptional() @IsString() size?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(toNum) @IsNumber() minPrice?: number;
  @ApiPropertyOptional() @IsOptional() @Transform(toNum) @IsNumber() maxPrice?: number;
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() featured?: boolean;
  @ApiPropertyOptional({ enum: ['featured', 'newest', 'price_asc', 'price_desc'] })
  @IsOptional()
  @IsIn(['featured', 'newest', 'price_asc', 'price_desc'])
  sort?: 'featured' | 'newest' | 'price_asc' | 'price_desc';
}

export class StockAlertDto {
  @IsString() variantId: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail() email: string;
  @IsOptional() @IsIn(LOCALES as readonly string[]) locale?: Locale;
}

// ─────────── admin: taxonomy ───────────

export class CategoryDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @Matches(SLUG) slug?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsObject() translations?: Record<string, Record<string, string>>;
  @IsOptional() @IsString() @MaxLength(160) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(320) seoDescription?: string;
}
export class UpdateCategoryDto extends PartialType(CategoryDto) {}

export class CollectionDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @Matches(SLUG) slug?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() coverImageUrl?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsObject() translations?: Record<string, Record<string, string>>;
  @IsOptional() @IsString() @MaxLength(160) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(320) seoDescription?: string;
}
export class UpdateCollectionDto extends PartialType(CollectionDto) {}

export class ColorDto {
  @IsString() @MaxLength(40) name: string;
  @IsOptional() @Matches(SLUG) slug?: string;
  @Matches(/^#[0-9A-Fa-f]{6}$/) hex: string;
  @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) hex2?: string | null;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsObject() translations?: Record<string, Record<string, string>>;
}
export class UpdateColorDto extends PartialType(ColorDto) {}

// ─────────── admin: products ───────────

export class VariantDto {
  @IsString() @MaxLength(64) sku: string;
  @IsOptional() @IsString() colorId?: string | null;
  @IsOptional() @IsString() @MaxLength(16) size?: string | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) compareAtPrice?: number | null;
  @IsInt() @Min(0) stock: number;
  @IsOptional() @IsString() @MaxLength(64) barcode?: string;
  @IsOptional() @IsInt() @Min(0) weightGrams?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateVariantDto extends PartialType(VariantDto) {}

export class StockUpdateDto {
  @ApiPropertyOptional({ description: 'Absolute stock value' }) @IsOptional() @IsInt() @Min(0) stock?: number;
  @ApiPropertyOptional({ description: 'Relative change, e.g. -2 or +10' }) @IsOptional() @IsInt() delta?: number;
}

export class ImageDto {
  @IsString() @MaxLength(500) url: string;
  @IsOptional() @IsString() @MaxLength(200) alt?: string;
  @IsOptional() @IsString() colorId?: string | null;
  @IsOptional() @IsInt() width?: number;
  @IsOptional() @IsInt() height?: number;
  @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateImageDto extends PartialType(ImageDto) {}

export class ProductDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @Matches(SLUG) slug?: string;
  @IsOptional() @IsString() @MaxLength(160) subtitle?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() story?: string;
  @IsOptional() @IsString() @MaxLength(200) material?: string;
  @IsOptional() @IsString() care?: string;
  @IsOptional() @IsString() @MaxLength(200) dimensions?: string;
  @IsOptional() @IsString() @MaxLength(60) madeIn?: string;
  @IsOptional() @IsString() sizeGuide?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) basePrice: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) compareAtPrice?: number | null;
  @IsOptional() @IsInt() @Min(0) taxRate?: number | null;
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsObject() translations?: Record<string, Record<string, string>>;
  @IsOptional() @IsString() @MaxLength(160) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(320) seoDescription?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) collectionIds?: string[];

  @ApiPropertyOptional({ type: [VariantDto], description: 'Only on create' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[];

  @ApiPropertyOptional({ type: [ImageDto], description: 'Only on create' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageDto)
  images?: ImageDto[];
}
export class UpdateProductDto extends PartialType(ProductDto) {}

export class AdminProductQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @Transform(toBool) @IsBoolean() lowStock?: boolean;
}
