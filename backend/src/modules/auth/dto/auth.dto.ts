import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { LOCALES, Locale } from '../../../common/utils/i18n.util';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export const PASSWORD_RULE = /^(?=.*[A-Za-zÇĞİÖŞÜçğıöşü])(?=.*\d).{8,72}$/;
const PASSWORD_MSG = 'Şifre en az 8 karakter olmalı, harf ve rakam içermelidir';

export class RegisterDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  @MaxLength(160)
  email: string;

  @ApiProperty()
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  password: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @ApiPropertyOptional({ enum: LOCALES })
  @IsOptional()
  @IsIn(LOCALES as readonly string[])
  locale?: Locale;
}

export class LoginDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(72)
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  token: string;

  @ApiProperty()
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  password: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  token: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(72)
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  newPassword: string;
}
