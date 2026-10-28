import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CouponType } from '@prisma/client';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { paginate, PaginationQueryDto, skipTake } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CouponDto, UpdateCouponDto } from './dto/coupon.dto';

@ApiTags('Admin · Coupons')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@Controller('admin/coupons')
export class CouponsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() q: PaginationQueryDto) {
    const where = q.q ? { code: { contains: q.q.toUpperCase() } } : {};
    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.coupon.count({ where }),
    ]);
    return paginate(items, total, q.page, q.limit);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.prisma.coupon.findUniqueOrThrow({
      where: { id },
      include: { redemptions: { orderBy: { createdAt: 'desc' }, take: 50, include: { order: { select: { orderNumber: true, total: true } } } } },
    });
  }

  @Post()
  create(@Body() dto: CouponDto) {
    this.validate(dto);
    return this.prisma.coupon.create({ data: dto });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    this.validate(dto);
    return this.prisma.coupon.update({ where: { id }, data: dto });
  }

  /** Coupons that were used are deactivated instead of deleted, to keep order history intact. */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const used = await this.prisma.couponRedemption.count({ where: { couponId: id } });
    if (used) {
      await this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
      return { ok: true, deactivated: true };
    }
    await this.prisma.coupon.delete({ where: { id } });
    return { ok: true };
  }

  private validate(dto: Partial<CouponDto>) {
    if (dto.type === CouponType.PERCENT && dto.value !== undefined && (dto.value <= 0 || dto.value > 100)) {
      throw new BadRequestException('Yüzde indirim 1-100 arasında olmalı');
    }
    if (dto.startsAt && dto.endsAt && dto.startsAt > dto.endsAt) throw new BadRequestException('Bitiş tarihi başlangıçtan önce olamaz');
  }
}
