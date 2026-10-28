import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/** Used by pm2/nginx/uptime checks. Lives outside the /api prefix. */
@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    const started = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'ok', dbLatencyMs: Date.now() - started, uptimeSec: Math.round(process.uptime()) };
  }
}
