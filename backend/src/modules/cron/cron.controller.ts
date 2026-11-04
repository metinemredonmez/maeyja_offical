import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { paginate, PaginationQueryDto, skipTake } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CronTrackerService } from './cron-tracker.service';

class CronRunQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;
}

/** Admin → Zamanlanmış işler. Starting a job can send e-mails (cart reminders), so admins only. */
@ApiTags('Admin · Scheduled jobs')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@Controller('admin/cron')
export class CronController {
  constructor(
    private readonly tracker: CronTrackerService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list() {
    return this.tracker.list();
  }

  @Get('runs')
  async runs(@Query() q: CronRunQueryDto) {
    const where = q.name ? { name: q.name } : {};
    const [rows, total] = await Promise.all([
      this.prisma.cronRun.findMany({ where, orderBy: { startedAt: 'desc' }, ...skipTake(q) }),
      this.prisma.cronRun.count({ where }),
    ]);
    return paginate(rows, total, q.page, q.limit);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(202)
  @Post(':name/run')
  run(@Param('name') name: string, @CurrentUser() user: AuthUser) {
    return this.tracker.trigger(name, user.id);
  }
}
