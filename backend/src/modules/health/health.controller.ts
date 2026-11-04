import { Controller, Get, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { InfraService } from './infra.service';

/** Used by pm2/nginx/uptime checks. Lives outside the /api prefix. */
@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly infra: InfraService,
  ) {}

  @Public()
  @Get()
  async check() {
    const started = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'ok', dbLatencyMs: Date.now() - started, uptimeSec: Math.round(process.uptime()) };
  }

  /** For external uptime monitors: flags only; 503 when the shop can't work (database down, disk full). */
  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const body = await this.infra.readiness();
    if (body.status === 'down') res.status(503);
    return body;
  }
}

/** Admin → Zamanlanmış işler → Sunucu: disk, uploads, database and backup numbers. */
@ApiTags('Admin · System')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@Controller('admin/system')
export class AdminSystemController {
  constructor(private readonly infra: InfraService) {}

  @Get('status')
  status() {
    return this.infra.status();
  }
}
