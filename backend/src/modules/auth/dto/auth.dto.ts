import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, registerDecorator } from 'class-validator';
import { LOCALES, Locale } from '../../../common/utils/i18n.util';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export const PASSWORD_RULE = /^(?=.*[A-Za-zÇĞİÖŞÜçğıöşü])(?=.*\d).{8,72}$/;
const PASSWORD_MSG = 'Şifre en az 8 karakter olmalı, harf ve rakam içermelidir';

/** Most common leaked passwords that still satisfy the regex. */
const COMMON_PASSWORDS = new Set(['password1', 'password123', 'qwerty123', 'abc12345', '12345678a', 'iloveyou1', 'letmein123', 'welcome123', 'admin123', 'admin1234', 'maeyja123', 'passw0rd', 'p@ssw0rd', 'sifre123', 'sifre1234', 'istanbul1', 'galatasaray1', 'fenerbahce1', '123456789a', 'qwertyuiop1']);

export function IsNotCommonPassword() {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isNotCommonPassword',
      target: target.constructor,
      propertyName,
      validator: {
        validate: (value: unknown) => typeof value !== 'string' || !COMMON_PASSWORDS.has(value.toLowerCase()),
        defaultMessage: () => 'Bu şifre çok yaygın; daha güçlü bir şifre seçin',
      },
    });
  };
}

export class RegisterDto {
  @ApiProperty()
  @Transform(lower)
  @IsEmail()
  @MaxLength(160)
  email: string;

  @ApiProperty()
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  @IsNotCommonPassword()
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
  @IsNotCommonPassword()
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
  @IsNotCommonPassword()
  newPassword: string;
}

export class MfaLoginDto {
  @ApiProperty() @IsString() @MaxLength(600) mfaToken: string;
  @ApiProperty({ description: '6-digit TOTP or a backup code' }) @IsString() @MaxLength(16) code: string;
}

export class MfaCodeDto {
  @ApiProperty() @IsString() @MaxLength(16) code: string;
}

export class MfaDisableDto {
  @ApiProperty() @IsString() @MaxLength(72) password: string;
  @ApiProperty() @IsString() @MaxLength(16) code: string;
}
