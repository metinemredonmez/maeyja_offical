import { Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AlertLevel, Prisma } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { paginate, PaginationQueryDto, skipTake } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ALERT_CATALOG, ALERT_CODES } from './alert-catalog';
import { AlertsService } from './alerts.service';

class AlertQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'resolved', 'all'], default: 'open' })
  @IsOptional()
  @IsIn(['open', 'resolved', 'all'])
  status?: 'open' | 'resolved' | 'all';

  @ApiPropertyOptional({ enum: AlertLevel })
  @IsOptional()
  @IsEnum(AlertLevel)
  level?: AlertLevel;
}

/** Admin → Uyarılar. Alerts carry order numbers and account hints, so they are for admins only. */
@ApiTags('Admin · Alerts')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@Controller('admin/alerts')
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@Query() q: AlertQueryDto) {
    const status = q.status ?? 'open';
    const where: Prisma.AlertWhereInput = {
      ...(status === 'open' ? { resolvedAt: null } : status === 'resolved' ? { resolvedAt: { not: null } } : {}),
      ...(q.level ? { level: q.level } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { detail: { contains: q.q, mode: 'insensitive' } }, { key: q.q }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.alert.findMany({ where, orderBy: [{ resolvedAt: { sort: 'desc', nulls: 'first' } }, { lastAt: 'desc' }], ...skipTake(q) }),
      this.prisma.alert.count({ where }),
    ]);
    return paginate(rows, total, q.page, q.limit);
  }

  /** The top bar's badge: open problems that were (or will be) mailed. */
  @Get('summary')
  async summary() {
    const [open, critical] = await Promise.all([
      this.prisma.alert.count({ where: { resolvedAt: null, level: { not: AlertLevel.INFO } } }),
      this.prisma.alert.count({ where: { resolvedAt: null, level: AlertLevel.CRITICAL } }),
    ]);
    return { open, critical };
  }

  /** For Ayarlar → Uyarılar: which alerts can be muted. */
  @Get('catalog')
  catalog() {
    return ALERT_CODES.map((code) => ({ code, ...ALERT_CATALOG[code] }));
  }

  @Patch(':id/resolve')
  async resolve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.prisma.alert.updateMany({ where: { id, resolvedAt: null }, data: { resolvedAt: new Date(), resolvedById: user.id, openKey: null } });
    return this.prisma.alert.findUniqueOrThrow({ where: { id } });
  }

  @HttpCode(200)
  @Post('resolve-all')
  async resolveAll(@CurrentUser() user: AuthUser) {
    const { count } = await this.prisma.alert.updateMany({ where: { resolvedAt: null }, data: { resolvedAt: new Date(), resolvedById: user.id, openKey: null } });
    return { resolved: count };
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('test')
  test() {
    return this.alerts.test();
  }
}
