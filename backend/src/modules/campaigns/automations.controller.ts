import { Controller, Get, HttpCode, Param, ParseEnumPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { Flow, FLOWS } from './automation.mail';
import { MailAutomationsService } from './automations.service';

/** Admin → Otomatik e-postalar (the texts and switches themselves are settings: mailWelcome, mailAfterPurchase, mailWinback). */
@ApiTags('Admin · Mail automations')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@Controller('admin/mail-automations')
export class MailAutomationsController {
  constructor(
    private readonly automations: MailAutomationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  stats() {
    return this.automations.stats();
  }

  /** The e-mail as a customer would get it, to the admin's own address. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('test/:flow')
  async test(@Param('flow', new ParseEnumPipe(Object.fromEntries(FLOWS.map((f) => [f, f])))) flow: Flow, @CurrentUser() user: AuthUser) {
    const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { email: true, firstName: true } });
    return this.automations.test(flow, me?.email ?? user.email, me?.firstName ?? null);
  }
}
