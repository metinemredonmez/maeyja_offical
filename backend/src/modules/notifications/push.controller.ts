import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PushStatus } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto, paginate, skipTake } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDeviceDto, SendPushDto } from './dto/push.dto';
import { PushService } from './push.service';

@ApiTags('Push')
@Controller()
export class PushController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /** Mobile app registers its OneSignal subscription; links it to the user when logged in. */
  @Public()
  @Post('devices')
  registerDevice(@Body() dto: RegisterDeviceDto, @CurrentUser() user?: AuthUser) {
    const data = { platform: dto.platform, appVersion: dto.appVersion, userId: user?.id ?? null, isActive: true, lastSeenAt: new Date() };
    return this.prisma.userDevice.upsert({
      where: { subscriptionId: dto.subscriptionId },
      create: { subscriptionId: dto.subscriptionId, ...data },
      update: data,
      select: { id: true, platform: true, isActive: true },
    });
  }

  @Public()
  @Delete('devices/:subscriptionId')
  async unregisterDevice(@Param('subscriptionId') subscriptionId: string) {
    await this.prisma.userDevice.updateMany({ where: { subscriptionId }, data: { isActive: false } });
    return { ok: true };
  }

  @ApiBearerAuth()
  @Roles(...ADMIN_ROLES)
  @Get('admin/push')
  async list(@Query() q: PaginationQueryDto) {
    const [items, total, devices] = await Promise.all([
      this.prisma.pushCampaign.findMany({ orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.pushCampaign.count(),
      this.prisma.userDevice.groupBy({ by: ['platform'], where: { isActive: true }, _count: true }),
    ]);
    return { ...paginate(items, total, q.page, q.limit), devices, providerEnabled: this.push.enabled };
  }

  @ApiBearerAuth()
  @Roles(...ADMIN_ROLES)
  @Post('admin/push')
  async send(@Body() dto: SendPushDto, @CurrentUser() user: AuthUser) {
    const campaign = await this.prisma.pushCampaign.create({
      data: {
        title: dto.title,
        body: dto.body,
        url: dto.url,
        imageUrl: dto.imageUrl,
        target: dto.target,
        targetUserIds: dto.userIds ?? [],
        createdById: user.id,
      },
    });
    const msg = { title: dto.title, body: dto.body, url: dto.url, imageUrl: dto.imageUrl };
    const result = dto.target === 'USERS' ? await this.push.sendToUsers(dto.userIds ?? [], msg) : await this.push.sendToAll(msg);
    return this.prisma.pushCampaign.update({
      where: { id: campaign.id },
      data: result.ok
        ? { status: PushStatus.SENT, providerId: result.id, recipients: result.recipients, sentAt: new Date() }
        : { status: PushStatus.FAILED, error: result.error },
    });
  }
}
