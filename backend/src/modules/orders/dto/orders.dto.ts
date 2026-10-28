import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentProvider, ReturnStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const PHONE = /^[+\d\s()-]{10,20}$/;

export class CheckoutAddressDto {
  @IsString() @Length(1, 60) firstName: string;
  @IsString() @Length(1, 60) lastName: string;
  @Matches(PHONE, { message: 'Geçerli bir telefon numarası girin' }) phone: string;
  @IsOptional() @IsString() @Length(2, 2) country?: string;
  @IsString() @Length(1, 60) city: string;
  @IsString() @Length(1, 60) district: string;
  @IsString() @Length(5, 200) line1: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @IsString() @MaxLength(12) postalCode?: string;
}

export class InvoiceDto {
  @IsIn(['INDIVIDUAL', 'CORPORATE']) type: 'INDIVIDUAL' | 'CORPORATE';

  @IsOptional() @Matches(/^\d{11}$/, { message: 'TC kimlik no 11 haneli olmalı' }) identityNumber?: string;

  @ValidateIf((o) => o.type === 'CORPORATE') @IsString() @Length(2, 160) companyName?: string;
  @ValidateIf((o) => o.type === 'CORPORATE') @IsString() @Length(2, 80) taxOffice?: string;
  @ValidateIf((o) => o.type === 'CORPORATE') @Matches(/^\d{10,11}$/, { message: 'Vergi no 10 haneli olmalı' }) taxNumber?: string;
}

export class CheckoutDto {
  @Transform(lower) @IsEmail() @MaxLength(160) email: string;

  @ApiPropertyOptional({ description: 'Saved address id (logged-in users) — or send shippingAddress' })
  @IsOptional()
  @IsString()
  shippingAddressId?: string;

  @ValidateIf((o) => !o.shippingAddressId)
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  shippingAddress?: CheckoutAddressDto;

  @IsOptional() @IsBoolean() billingSameAsShipping?: boolean = true;

  @ValidateIf((o) => o.billingSameAsShipping === false)
  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  billingAddress?: CheckoutAddressDto;

  @IsOptional() @ValidateNested() @Type(() => InvoiceDto) invoice?: InvoiceDto;

  @IsEnum(PaymentProvider) paymentMethod: PaymentProvider;

  @IsOptional() @IsString() @MaxLength(500) customerNote?: string;

  @ApiPropertyOptional({ description: 'Distance sales agreement + preliminary information form accepted' })
  @Equals(true, { message: 'Mesafeli satış sözleşmesini onaylamanız gerekiyor' })
  acceptTerms: boolean;

  @IsOptional() @IsBoolean() saveAddress?: boolean;

  @IsOptional() @IsBoolean() subscribeNewsletter?: boolean;
}

export class OrderLookupDto {
  @IsString() @MaxLength(32) orderNumber: string;
  @Transform(lower) @IsEmail() email: string;
}

export class RetryPaymentDto {
  @ApiPropertyOptional({ description: 'Required for guest orders' })
  @IsOptional()
  @Transform(lower)
  @IsEmail()
  email?: string;
}

export class ReturnItemDto {
  @IsString() orderItemId: string;
  @IsInt() @Min(1) quantity: number;
}

export class ReturnRequestDto {
  @IsOptional() @Transform(lower) @IsEmail() email?: string;
  @IsString() @Length(5, 1000) reason: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReturnItemDto) items: ReturnItemDto[];
}

// ─────────── admin ───────────

export class AdminOrderQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsEnum(PaymentProvider) provider?: PaymentProvider;
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus) status: OrderStatus;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @ApiPropertyOptional({ description: 'On REFUNDED after shipping: put items back in stock' })
  @IsOptional()
  @IsBoolean()
  restock?: boolean;
  @ApiPropertyOptional({ description: 'On CANCELLED/REFUNDED of an iyzico order: try to cancel the payment at iyzico' })
  @IsOptional()
  @IsBoolean()
  refundOnProvider?: boolean;
  @IsOptional() @IsBoolean() notifyCustomer?: boolean = true;
}

export class ShipOrderDto {
  @IsString() @MaxLength(40) carrier: string;
  @IsString() @MaxLength(64) trackingNumber: string;
  @IsOptional() @IsString() @MaxLength(500) trackingUrl?: string;
  @IsOptional() @IsBoolean() notifyCustomer?: boolean = true;
}

export class OrderNoteDto {
  @IsString() @MaxLength(2000) adminNote: string;
}

export class AdminReturnQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(ReturnStatus) status?: ReturnStatus;
}

export class UpdateReturnDto {
  @IsEnum(ReturnStatus) status: ReturnStatus;
  @IsOptional() @IsString() @MaxLength(1000) adminNote?: string;
}
