import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DevicePlatform, PushTarget } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'OneSignal subscription id' })
  @IsString()
  @MaxLength(128)
  subscriptionId: string;

  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}

export class SendPushDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  title: string;

  @ApiProperty()
  @IsString()
  @MaxLength(240)
  body: string;

  @ApiPropertyOptional({ description: 'Deep link or web URL opened on tap' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({ enum: PushTarget })
  @IsEnum(PushTarget)
  target: PushTarget;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((o) => o.target === PushTarget.USERS)
  @IsArray()
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  userIds?: string[];
}
