import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ClientIp } from '../../common/decorators/client-ip.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { LOCALES, resolveLocale } from '../../common/utils/i18n.util';
import { AssistantService } from './assistant.service';

class ChatTurnDto {
  @IsIn(['user', 'assistant']) role: 'user' | 'assistant';
  @IsString() @MaxLength(2000) content: string;
}

class ChatDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ChatTurnDto) messages: ChatTurnDto[];
  @IsOptional() @IsIn(LOCALES) locale?: string;
}

/** Storefront chat. Nothing is stored: the visitor's browser keeps the conversation and sends it each time. */
@ApiTags('Assistant')
@Public()
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  // NET-03: the address from `trust proxy` (nginx and the web proxy), never a raw X-Forwarded-For.
  chat(@Body() dto: ChatDto, @ClientIp() ip: string) {
    return this.assistant.chat(dto.messages, resolveLocale(dto.locale), ip);
  }
}
