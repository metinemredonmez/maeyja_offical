import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, registerDecorator } from 'class-validator';
import { emailTransform as lower } from '../../../common/utils/email.util';
import { LOCALES, Locale } from '../../../common/utils/i18n.util';

/** PWD-01/02: one rule everywhere (sign-up, reset, change, staff): 15–128 characters, no composition rules. */
export const PASSWORD_RULE = /^.{15,128}$/su;
export const PASSWORD_MSG = 'Şifre en az 15 karakter olmalı';

/** PWD-03: common long passwords, a short pattern repeated, or a known word padded with digits and symbols. */
const COMMON_PASSWORDS = new Set(['123456789012345', '1234567890123456', 'qwertyuiopasdfg', 'qwertyuiopasdfgh', 'qwertyuiopasdfghjkl', '1q2w3e4r5t6y7u8i', 'abcdefghijklmno', 'passwordpassword', 'iloveyouiloveyou', 'qazwsxedcrfvtgb', 'zaq12wsxcde34rfv']);
const PADDED_WORD = /^(?:maeyja|canan|delettre|password|passw0rd|sifre|şifre|parola|qwerty|admin|istanbul|galatasaray|fenerbahce|besiktas|trabzonspor)[\d\W_]*$/iu;
const isCommonPassword = (value: string) => {
  const v = value.toLowerCase();
  return COMMON_PASSWORDS.has(v) || /^(.{1,5})\1+$/su.test(v) || PADDED_WORD.test(v);
};

export function IsNotCommonPassword() {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isNotCommonPassword',
      target: target.constructor,
      propertyName,
      validator: {
        validate: (value: unknown) => typeof value !== 'string' || !isCommonPassword(value),
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
  @MaxLength(128)
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
  @MaxLength(128)
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

export class MfaEnableDto extends MfaCodeDto {
  @ApiPropertyOptional({ description: '6-digit code e-mailed by mfa/setup (required when it was sent)' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  emailCode?: string;
}

export class MfaDisableDto {
  @ApiProperty() @IsString() @MaxLength(128) password: string;
  @ApiProperty() @IsString() @MaxLength(16) code: string;
}
