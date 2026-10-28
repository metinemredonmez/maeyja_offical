import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const emptyToNull = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? null : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class MailAccountDto {
  @Transform(lower) @IsEmail() @MaxLength(200) email: string;
  @IsString() @Length(1, 200) password: string;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(120) fromName?: string | null;
  @IsString() @Length(1, 255) imapHost: string;
  @IsInt() @Min(1) @Max(65535) imapPort: number;
  @IsBoolean() imapSecure: boolean;
  @IsString() @Length(1, 255) smtpHost: string;
  @IsInt() @Min(1) @Max(65535) smtpPort: number;
  @IsBoolean() smtpSecure: boolean;
  @IsOptional() @IsBoolean() allowSelfSigned?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @Transform(emptyToNull) @IsOptional() @IsString() @MaxLength(5000) signatureHtml?: string | null;
}

/** Same fields, all optional; omit `password` to keep the stored one. */
export class UpdateMailAccountDto extends PartialType(MailAccountDto) {}

export class MailQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(['INBOX', 'SENT']) folder?: 'INBOX' | 'SENT';
  @IsOptional() @IsString() @MaxLength(40) accountId?: string;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() unread?: boolean;
}

export class MarkReadDto {
  @IsBoolean() isRead: boolean;
}

export class SendMailDto {
  @IsOptional() @IsString() @MaxLength(40) accountId?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsEmail({}, { each: true }) to: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsEmail({}, { each: true }) cc?: string[];
  @IsString() @Length(1, 300) subject: string;
  @IsString() @Length(1, 200_000) html: string;
  @IsOptional() @IsString() @MaxLength(40) replyToId?: string;
}
