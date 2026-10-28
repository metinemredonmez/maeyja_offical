import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { MailAccountDto, MailQueryDto, MarkReadDto, SendMailDto, UpdateMailAccountDto } from './dto/mailbox.dto';
import { MailboxService } from './mailbox.service';

@ApiTags('Mailbox')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@Controller('admin/mail')
export class MailboxController {
  constructor(private readonly mail: MailboxService) {}

  // ───────── accounts ─────────
  @Get('accounts') accounts() { return this.mail.accounts(); }
  @Post('accounts') createAccount(@Body() dto: MailAccountDto) { return this.mail.createAccount(dto); }
  @Patch('accounts/:id') updateAccount(@Param('id') id: string, @Body() dto: UpdateMailAccountDto) { return this.mail.updateAccount(id, dto); }
  @Delete('accounts/:id') deleteAccount(@Param('id') id: string) { return this.mail.deleteAccount(id); }
  @HttpCode(200) @Post('accounts/:id/test') testAccount(@Param('id') id: string) { return this.mail.testAccount(id); }

  // ───────── messages ─────────
  @Get('messages') list(@Query() q: MailQueryDto) { return this.mail.list(q); }
  @Get('unread-count') unread() { return this.mail.unreadCount(); }
  @Get('messages/:id') get(@Param('id') id: string) { return this.mail.get(id); }
  @Patch('messages/:id') markRead(@Param('id') id: string, @Body() dto: MarkReadDto) { return this.mail.markRead(id, dto.isRead); }
  @Delete('messages/:id') remove(@Param('id') id: string) { return this.mail.remove(id); }

  /** Always served as a download (never rendered inline) — attachments are untrusted. */
  @Get('messages/:id/attachments/:index')
  async attachment(@Param('id') id: string, @Param('index', ParseIntPipe) index: number, @Res() res: Response) {
    const a = await this.mail.attachment(id, index);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${a.filename.replace(/[^\w.\- ]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(Buffer.from(a.data));
  }

  @HttpCode(200) @Post('send') send(@Body() dto: SendMailDto, @CurrentUser() user: AuthUser) { return this.mail.send(dto, user.id); }
  @HttpCode(200) @Post('sync') sync() { return this.mail.syncAll(); }
}
