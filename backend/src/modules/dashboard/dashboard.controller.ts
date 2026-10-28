import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { paginate, PaginationQueryDto, skipTake } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

@ApiTags('Admin · Dashboard')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@Controller('admin')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  overview() {
    return this.dashboard.overview();
  }

  @Get('audit-logs')
  async auditLogs(@Query() q: PaginationQueryDto) {
    const where = q.q ? { OR: [{ action: { contains: q.q, mode: 'insensitive' as const } }, { entityId: q.q }] } : {};
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => Boolean(x)))];
    const actors = await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true, firstName: true } });
    return paginate(rows.map((r) => ({ ...r, actor: actors.find((a) => a.id === r.actorId) ?? null })), total, q.page, q.limit);
  }
}
