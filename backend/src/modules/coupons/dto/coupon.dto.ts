import { PartialType } from '@nestjs/swagger';
import { CouponType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CouponDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9_-]{3,32}$/, { message: 'Kod 3-32 karakter: harf, rakam, - veya _' })
  code: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsEnum(CouponType) type: CouponType;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) value: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minOrderAmount?: number | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) maxDiscount?: number | null;
  @IsOptional() @IsInt() @Min(1) usageLimit?: number | null;
  @IsOptional() @IsInt() @Min(1) usageLimitPerUser?: number | null;
  @IsOptional() @Type(() => Date) @IsDate() startsAt?: Date | null;
  @IsOptional() @Type(() => Date) @IsDate() endsAt?: Date | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCouponDto extends PartialType(CouponDto) {}
