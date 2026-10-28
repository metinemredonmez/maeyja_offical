import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { LOCALES, Locale } from '../../../common/utils/i18n.util';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { PASSWORD_RULE } from '../../auth/dto/auth.dto';

export class UpdateProfileDto {
  @IsOptional() @IsString() @Length(1, 60) firstName?: string;
  @IsOptional() @IsString() @Length(1, 60) lastName?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsIn(LOCALES as readonly string[]) locale?: Locale;
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;
}

export class AddressDto {
  @IsOptional() @IsString() @MaxLength(40) title?: string;
  @IsString() @Length(1, 60) firstName: string;
  @IsString() @Length(1, 60) lastName: string;
  @IsString() @Matches(/^[+\d\s()-]{10,20}$/, { message: 'Geçerli bir telefon numarası girin' }) phone: string;
  @IsOptional() @IsString() @Length(2, 2) country?: string;
  @IsString() @Length(1, 60) city: string;
  @IsString() @Length(1, 60) district: string;
  @IsString() @Length(5, 200) line1: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @IsString() @MaxLength(12) postalCode?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(AddressDto) {}

export class AdminUserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserRole }) @IsOptional() @IsEnum(UserRole) role?: UserRole;
}

export class AdminUpdateUserDto {
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @Length(1, 60) firstName?: string;
  @IsOptional() @IsString() @Length(1, 60) lastName?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
}

export class CreateStaffDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;
  @IsString() @Matches(PASSWORD_RULE, { message: 'Şifre en az 8 karakter olmalı, harf ve rakam içermelidir' }) password: string;
  @IsString() @Length(1, 60) firstName: string;
  @IsString() @Length(1, 60) lastName: string;
  @IsEnum(UserRole) role: UserRole;
}
